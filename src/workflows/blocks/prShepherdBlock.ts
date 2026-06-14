import * as restate from '@restatedev/restate-sdk';
import { fetchPrState, updateBranch, mergePR } from '../actions/prActions';
import { IssueState } from '../../../issueState';
import { geminiLoop } from './geminiLoop';

const MAX_PLAN_ITERATIONS = 1000;

export async function prShepherdBlock(
  ctx: restate.WorkflowContext,
  issueNumber: number,
  prNumber: number,
  fullRepo: string,
  prefix: string = 'pr-shepherd',
  maxIterations: number = MAX_PLAN_ITERATIONS,
) {
  let iteration = 0;
  while (iteration < maxIterations) {
    iteration++;

    const { state, prDetails, unaddressedCommentIds } = await ctx.run(
      `${prefix}-fetch-pr-state-${iteration}`,
      () => fetchPrState(prNumber, fullRepo),
    );

    if (state === IssueState.MERGED || state === IssueState.CLOSED) {
      return state;
    }

    if (prDetails.mergeStateStatus === 'BEHIND') {
      await ctx.run(`${prefix}-update-branch-${iteration}`, () => updateBranch(prNumber, fullRepo));
      await ctx.sleep(30 * 1000);
      continue;
    }

    const hasCiFailure = prDetails.statusCheckRollup?.some(
      (check) => check.state === 'FAILURE' || check.state === 'ERROR',
    );

    if (hasCiFailure || unaddressedCommentIds.length > 0) {
      const issueParam = `for issue ${issueNumber}`;
      const prompt = `use the anton-pr-fix skill flow ${issueParam} for PR ${prNumber} on branch ${prDetails.headRefName} in repo ${fullRepo}. ${hasCiFailure ? 'Fix the CI failures.' : ''} ${unaddressedCommentIds.length > 0 ? `Address comment IDs ${unaddressedCommentIds.join(', ')}.` : ''}`;

      await geminiLoop(ctx, `${prefix}-execute-gemini-${iteration}`, issueNumber, prompt, 'pr-fix');
      continue;
    }

    if (
      prDetails.reviewDecision === 'APPROVED' &&
      prDetails.mergeable === 'MERGEABLE' &&
      (!prDetails.statusCheckRollup ||
        prDetails.statusCheckRollup.every((c) => c.state === 'SUCCESS' || c.state === 'SKIPPED'))
    ) {
      try {
        await ctx.run(`${prefix}-merge-pr-${iteration}`, () => mergePR(prNumber, fullRepo));
        return IssueState.MERGED;
      } catch (e) {
        // Merge failed, will retry next loop
        console.warn(`Failed to merge PR ${prNumber} in ${fullRepo}`, e);
      }
    }

    await ctx.sleep(5 * 60 * 1000);
  }

  return IssueState.FAILED;
}
