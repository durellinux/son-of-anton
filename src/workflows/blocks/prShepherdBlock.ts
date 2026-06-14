import * as restate from '@restatedev/restate-sdk';
import { fetchPrState, updateBranch } from '../actions/prActions';
import { IssueState } from '../../../issueState';
import { geminiLoop } from './geminiLoop';

export async function prShepherdBlock(
  ctx: restate.WorkflowContext,
  issueNumber: number,
  prNumber: number,
  fullRepo: string,
  iteration: number,
  prefix: string = 'pr-shepherd',
): Promise<{ state: IssueState; waitTimeMs: number }> {
  const { state, prDetails, unaddressedCommentIds } = await ctx.run(
    `${prefix}-fetch-pr-state-${iteration}-${prNumber}`,
    () => fetchPrState(prNumber, fullRepo),
  );

  if (state === IssueState.MERGED || state === IssueState.CLOSED) {
    return { state, waitTimeMs: 0 };
  }

  if (prDetails.mergeable === 'CONFLICTING' || prDetails.mergeStateStatus === 'DIRTY') {
    return { state: IssueState.CONFLICT_DETECTED, waitTimeMs: 15 * 60 * 1000 };
  }

  if (prDetails.mergeStateStatus === 'BEHIND') {
    await ctx.run(`${prefix}-update-branch-${iteration}-${prNumber}`, () => updateBranch(prNumber, fullRepo));
    return { state: IssueState.WAITING, waitTimeMs: 30 * 1000 };
  }

  const hasCiFailure = prDetails.statusCheckRollup?.some(
    (check) => check.state === 'FAILURE' || check.state === 'ERROR',
  );

  if (hasCiFailure || unaddressedCommentIds.length > 0) {
    const issueParam = `for issue ${issueNumber}`;
    const prompt = `use the anton-pr-fix skill flow ${issueParam} for PR ${prNumber} on branch ${prDetails.headRefName} in repo ${fullRepo}. ${hasCiFailure ? 'Fix the CI failures.' : ''} ${unaddressedCommentIds.length > 0 ? `Address comment IDs ${unaddressedCommentIds.join(', ')}.` : ''}`;

    await geminiLoop(ctx, `${prefix}-execute-gemini-${iteration}-${prNumber}`, issueNumber, prompt, 'pr-fix');
    return { state: IssueState.WAITING, waitTimeMs: 0 };
  }

  return { state: IssueState.WAITING, waitTimeMs: 5 * 60 * 1000 };
}
