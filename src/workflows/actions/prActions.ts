import { execa } from 'execa';
import {
  determinePRState,
  getUnaddressedPRComments,
  IssueState,
  PRComment,
  PullRequest,
} from '../../../issueState';

export async function updateBranch(prNumber: number, fullRepo: string) {
  await execa('gh', ['pr', 'update-branch', String(prNumber), '-R', fullRepo, '--rebase']);
}

export async function mergePR(prNumber: number, fullRepo: string) {
  await execa('gh', [
    'pr',
    'merge',
    String(prNumber),
    '-R',
    fullRepo,
    '--squash',
    '--delete-branch',
  ]);
}

export async function fetchPrState(prNumber: number, fullRepo: string) {
  const { stdout: prDetailsJson } = await execa('gh', [
    'pr',
    'view',
    String(prNumber),
    '-R',
    fullRepo,
    '--json',
    'number,headRefName,url,reviewDecision,state,statusCheckRollup,mergeStateStatus,mergeable',
  ]);
  const prDetails = JSON.parse(prDetailsJson) as PullRequest;

  const state = determinePRState(prDetails);

  let unaddressedCommentIds: number[] = [];
  if (state === IssueState.NEEDS_IMPLEMENTATION) {
    const { stdout: commentsJson } = await execa('gh', [
      'api',
      `repos/${fullRepo}/pulls/${prNumber}/comments`,
    ]);
    const comments = JSON.parse(commentsJson) as PRComment[];
    unaddressedCommentIds = getUnaddressedPRComments(comments);
  }

  return { state, prDetails, unaddressedCommentIds };
}

export async function fetchPrFiles(prNumber: number, fullRepo: string): Promise<string[]> {
  const { stdout: filesJson } = await execa('gh', [
    'pr',
    'view',
    String(prNumber),
    '-R',
    fullRepo,
    '--json',
    'files',
  ]);
  const { files } = JSON.parse(filesJson);
  return files.map((f: any) => f.path);
}
