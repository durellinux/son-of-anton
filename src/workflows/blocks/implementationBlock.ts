import * as restate from '@restatedev/restate-sdk';
import { fetchIssueState, updateRepository } from '../actions/issuesActions';
import { IssueState } from '../../../issueState';
import { getPlanningSession } from '../actions/planActions';
import { geminiLoop } from './geminiLoop';

export async function implementationBlock(
  ctx: restate.WorkflowContext,
  issueNumber: number,
  issueRepo: string,
  title: string,
  issueUrl: string,
  workflowUrl: string,
  prefix: string = 'implementation',
) {
  const { state } = await ctx.run(`${prefix}-fetch-issue-state`, () =>
    fetchIssueState(issueNumber, issueRepo),
  );

  await ctx.run(`${prefix}-update-repository`, () =>
    updateRepository(issueNumber, title, issueUrl, state, workflowUrl),
  );

  if (state !== IssueState.NEEDS_IMPLEMENTATION) {
    return;
  }

  const localPlanningSession = await ctx.run(`${prefix}-get-planning-session`, () =>
    getPlanningSession(issueNumber),
  );

  let prompt = `follow the anton-implement skill flow for issue ${issueNumber} on the repo ${issueRepo}`;
  if (
    localPlanningSession &&
    localPlanningSession.history &&
    localPlanningSession.history.length > 0
  ) {
    const approvedPlan = localPlanningSession.history[localPlanningSession.history.length - 1].plan;
    prompt += `\n\nHere is the approved plan you must implement:\n${approvedPlan}`;
  }

  await geminiLoop(ctx, `${prefix}-execute-gemini`, issueNumber, prompt, 'implement');

  // Update state after implementation
  await ctx.run(`${prefix}-update-repository-final`, () =>
    updateRepository(issueNumber, title, issueUrl, IssueState.WAITING_PR_REVIEW, workflowUrl),
  );
}
