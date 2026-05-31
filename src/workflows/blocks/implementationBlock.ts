import * as restate from '@restatedev/restate-sdk';
import { fetchIssueState, updateRepository } from '../actions/issuesActions';
import { IssueState } from '../../../issueState';
import { executeGemini } from '../gemini';

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
  await ctx.run(`${prefix}-execute-gemini`, () => executeGemini(issueNumber, prompt, 'implement'));

  // Update state after implementation
  await ctx.run(`${prefix}-update-repository-final`, () =>
    updateRepository(issueNumber, title, issueUrl, IssueState.WAITING_PR_REVIEW, workflowUrl),
  );
}
