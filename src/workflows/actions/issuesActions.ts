import {
  determineIssueState,
  GHRawIssue,
  Issue as GH_Issue,
  IssueState,
} from '../../../issueState';
import { Issue, IssueStatus } from '../../api';
import { FileSystemIssueRepository } from '../../repositories/fileSystemIssueRepository';
import { execa } from 'execa';

const repository = new FileSystemIssueRepository();

function mapStateToStatus(state: IssueState): IssueStatus {
  switch (state) {
    case IssueState.YOLO:
      return IssueStatus.YOLO;
    case IssueState.NEEDS_PLANNING:
      return IssueStatus.PLANNING;
    case IssueState.SPECIFYING:
      return IssueStatus.SPECIFYING;
    case IssueState.NEEDS_IMPLEMENTATION:
      return IssueStatus.IMPLEMENTING;
    case IssueState.WAITING_PR_REVIEW:
      return IssueStatus.WAITING_PR_REVIEW;
    case IssueState.WAITING:
      return IssueStatus.WAITING_PLAN_REVIEW;
    case IssueState.CLOSED:
      return IssueStatus.CLOSED;
    case IssueState.MERGED:
      return IssueStatus.DONE;
    default:
      return IssueStatus.PLANNING;
  }
}

export async function addLabel(issueNumber: number, repo: string, label: string) {
  await execa('gh', ['issue', 'edit', String(issueNumber), '-R', repo, '--add-label', label]);
}

export async function removeLabel(issueNumber: number, repo: string, label: string) {
  await execa('gh', ['issue', 'edit', String(issueNumber), '-R', repo, '--remove-label', label]);
}

export async function fetchConnectedPRs(issueNumber: number, repo: string): Promise<number[]> {
  const { stdout: issueDetailsJson } = await execa('gh', [
    'issue',
    'view',
    String(issueNumber),
    '-R',
    repo,
    '--json',
    'closedByPullRequestsReferences',
  ]);
  const rawDetails = JSON.parse(issueDetailsJson) as GHRawIssue;
  if (!rawDetails.closedByPullRequestsReferences) return [];
  return rawDetails.closedByPullRequestsReferences.map((pr) => pr.number);
}

export async function fetchIssueDetails(issueNumber: number, issueRepo: string): Promise<GH_Issue> {
  const { stdout: issueDetailsJson } = await execa('gh', [
    'issue',
    'view',
    String(issueNumber),
    '-R',
    issueRepo,
    '--json',
    'body,closedByPullRequestsReferences,state,labels',
  ]);
  const rawDetails = JSON.parse(issueDetailsJson) as GHRawIssue;

  if (
    rawDetails.closedByPullRequestsReferences &&
    rawDetails.closedByPullRequestsReferences.length > 0
  ) {
    const { stdout: prDetailsJson } = await execa('gh', [
      'pr',
      'view',
      String(rawDetails.closedByPullRequestsReferences[0].number),
      '-R',
      issueRepo,
      '--json',
      'headRefName',
    ]);
    const branch = (JSON.parse(prDetailsJson) as any).headRefName;
    rawDetails.branch = branch;
  }

  return {
    body: rawDetails.body,
    state: rawDetails.state,
    branch: rawDetails.branch,
    labels: rawDetails.labels ? rawDetails.labels.map((l: any) => l.name) : undefined,
  };
}

export async function fetchIssueState(issueNumber: number, issueRepo: string) {
  const localPlanningSession = await repository.getPlanningSession(issueNumber);
  const issueDetails = await fetchIssueDetails(issueNumber, issueRepo);
  const state = determineIssueState(issueDetails, localPlanningSession as any);
  return { state };
}

export async function updateRepository(
  issueNumber: number,
  title: string,
  url: string,
  state: IssueState,
  workflowUrl: string,
) {
  const issue: Issue = {
    number: issueNumber,
    title: title,
    url: url,
    status: mapStateToStatus(state),
    workflowUrl,
  };
  await repository.saveIssue(issue);
}

export async function createGitHubIssue(
  repo: string,
  title: string,
  body: string,
  labels: string[],
): Promise<number> {
  const args = ['issue', 'create', '-R', repo, '-t', title, '-b', body];
  for (const label of labels) {
    args.push('-l', label);
  }
  const { stdout } = await execa('gh', args);
  const match = stdout.match(/\/issues\/(\d+)/);
  if (!match) {
    throw new Error(`Failed to parse issue number from gh output: ${stdout}`);
  }
  return parseInt(match[1], 10);
}
