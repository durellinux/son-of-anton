import { execa } from 'execa';
import { FileSystemIssueRepository } from '../../repositories/fileSystemIssueRepository';
import { IssueStatus } from '../../api';
import { IssueState } from '../../../issueState';

const repository = new FileSystemIssueRepository();

export async function getPlanningSession(issueNumber: number) {
  return repository.getPlanningSession(issueNumber);
}

export async function deletePlanningSession(issueNumber: number) {
  return repository.deletePlanningSession(issueNumber);
}

export async function commitPlan(issueNumber: number, issueRepo: string) {
  const localPlanningSession = await getPlanningSession(issueNumber);

  if (!localPlanningSession) {
    throw new Error('No local planning session found');
  }

  const lastStep = localPlanningSession.history[localPlanningSession.history.length - 1];
  const commentBody = `${lastStep.plan}\n\n#son-of-anton-plan`;
  const { stdout: commentJson } = await execa('gh', [
    'api',
    `repos/${issueRepo}/issues/${issueNumber}/comments`,
    '-f',
    `body=${commentBody}`,
  ]);
  return commentJson;
}

export async function thumbsUpPlan(issueRepo: string, githubComment: any) {
  const comment = JSON.parse(githubComment);
  await execa('gh', [
    'api',
    `repos/${issueRepo}/issues/comments/${comment.id}/reactions`,
    '-f',
    'content=+1',
  ]);
}

export function buildPlanningPrompt(
  issueNumber: number,
  issueRepo: string,
  state: IssueState,
): string {
  if (state === IssueState.YOLO) {
    return `Research, plan and implement the fix for issue ${issueNumber} on the repo ${issueRepo}. Follow the anton-plan and anton-implement skills workflow.`;
  } else if (state === IssueState.NEEDS_PLANNING) {
    return `follow the anton-plan skill flow for issue ${issueNumber} on the repo ${issueRepo}`;
  }

  throw new Error(`Unsupported state: ${state}`);
}
