import * as restate from '@restatedev/restate-sdk';
import { fetchPrState, updateBranch } from '../actions/prActions';
import { IssueState } from '../../../issueState';
import { llmLoop } from './llmLoop';

export async function prShepherdBlock(
  ctx: restate.WorkflowContext,
  issueNumber: number,
  prNumber: number,
  fullRepo: string,
  iteration: number,
  prefix: string = 'pr-shepherd',
): Promise<{ state: IssueState; waitTimeMs: number }> {
  const { state, prDetails, unaddressedCommentIds, unaddressedComments } = await ctx.run(
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
    await ctx.run(`${prefix}-update-branch-${iteration}-${prNumber}`, () =>
      updateBranch(prNumber, fullRepo),
    );
    return { state: IssueState.WAITING, waitTimeMs: 30 * 1000 };
  }

  const hasCiFailure = prDetails.statusCheckRollup?.some(
    (check) => check.state === 'FAILURE' || check.state === 'ERROR',
  );

  if (hasCiFailure) {
    const issueParam = `for issue ${issueNumber}`;
    const prompt = `use the anton-pr-fix skill flow ${issueParam} for PR ${prNumber} on branch ${prDetails.headRefName} in repo ${fullRepo}. Fix the CI failures.`;

    await llmLoop(ctx, `${prefix}-fix-ci-${iteration}-${prNumber}`, issueNumber, prompt, 'pr-fix');
    return { state: IssueState.WAITING, waitTimeMs: 5 * 60 * 1000 };
  }

  if (unaddressedCommentIds.length > 0) {
    let commentsPrompt = `Here are the unaddressed review comments on the PR:\n\n`;
    for (const comment of unaddressedComments || []) {
      commentsPrompt += `- **File**: ${comment.path}:${comment.line}\n`;
      commentsPrompt += `  **Comment**: ${comment.body}\n`;
      if (comment.diffHunk) {
        commentsPrompt += `  **Diff Hunk**:\n\`\`\`diff\n${comment.diffHunk}\n\`\`\`\n\n`;
      }
    }

    const issueParam = `for issue ${issueNumber}`;
    const prompt = `use the anton-pr-fix skill flow ${issueParam} for PR ${prNumber} on branch ${prDetails.headRefName} in repo ${fullRepo}. Address comment IDs ${unaddressedCommentIds.join(', ')}.\n\n${commentsPrompt}`;

    await llmLoop(
      ctx,
      `${prefix}-fix-comments-${iteration}-${prNumber}`,
      issueNumber,
      prompt,
      'pr-fix',
    );
    return { state: IssueState.WAITING, waitTimeMs: 5 * 60 * 1000 };
  }

  return { state: IssueState.WAITING, waitTimeMs: 5 * 60 * 1000 };
}
