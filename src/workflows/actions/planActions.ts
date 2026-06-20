import { execa } from 'execa';
import { FileSystemIssueRepository } from '../../repositories/fileSystemIssueRepository';
import { IssueState } from '../../../issueState';

const repository = new FileSystemIssueRepository();

import { PlanningSession } from '../../api';

export async function savePlanningSession(session: PlanningSession) {
  return repository.savePlanningSession(session);
}

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

export function buildPlanningPrompt(
  issueNumber: number,
  issueRepo: string,
  state: IssueState,
  planningSession?: PlanningSession | null,
): string {
  let prompt = '';
  if (state === IssueState.YOLO) {
    prompt = `Research, plan and implement the fix for issue ${issueNumber} on the repo ${issueRepo}. Follow the anton-plan and anton-implement skills workflow.`;
  } else if (state === IssueState.NEEDS_PLANNING) {
    prompt = `follow the anton-plan skill flow for issue ${issueNumber} on the repo ${issueRepo}`;
  } else {
    throw new Error(`Unsupported state: ${state}`);
  }

  if (planningSession && planningSession.history && planningSession.history.length > 0) {
    prompt += `\n\nHere is the history of previous plans and user feedback for this issue:\n`;
    planningSession.history.forEach((step, index) => {
      prompt += `\n--- Iteration ${index + 1} ---\n`;
      prompt += `Proposed Plan:\n${step.plan}\n`;
      if (step.feedback) {
        prompt += `Feedback:\n${step.feedback}\n`;
      }
    });
  }

  return prompt;
}
