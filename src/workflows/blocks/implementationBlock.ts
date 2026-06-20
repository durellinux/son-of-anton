import * as restate from '@restatedev/restate-sdk';
import { fetchIssueState, updateRepository } from '../actions/issuesActions';
import { IssueState } from '../../../issueState';
import { llmLoop } from './llmLoop';

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

  const prompt = `follow the anton-implement skill flow for issue ${issueNumber} on the repo ${issueRepo}`;
  await llmLoop(ctx, `${prefix}-execute-llm`, issueNumber, prompt, 'implement');

  // Update state after implementation
  await ctx.run(`${prefix}-update-repository-final`, () =>
    updateRepository(issueNumber, title, issueUrl, IssueState.WAITING_PR_REVIEW, workflowUrl),
  );
}
