import { execa } from 'execa';
import { determinePRState, IssueState, PRComment, PullRequest } from '../../../issueState';

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

export interface DetailedPRComment extends PRComment {
  path: string;
  line?: number;
  diffHunk?: string;
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
  let unaddressedComments: DetailedPRComment[] = [];
  if (state === IssueState.NEEDS_IMPLEMENTATION) {
    const { stdout: commentsJson } = await execa('gh', [
      'api',
      `repos/${fullRepo}/pulls/${prNumber}/comments`,
    ]);
    const comments = JSON.parse(commentsJson) as any[];
    const unaddressed = comments.filter((comment) => (comment.reactions?.['+1'] || 0) === 0);
    unaddressedCommentIds = unaddressed.map((comment) => comment.id);
    unaddressedComments = unaddressed.map((comment) => ({
      id: comment.id,
      body: comment.body,
      state: comment.state,
      reactions: comment.reactions || {},
      path: comment.path,
      line: comment.line ?? comment.original_line,
      diffHunk: comment.diff_hunk,
    }));
  }

  return { state, prDetails, unaddressedCommentIds, unaddressedComments };
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
