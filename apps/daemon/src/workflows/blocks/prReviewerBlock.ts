import * as restate from '@restatedev/restate-sdk';
import { llmLoop } from './llmLoop';

export async function prReviewerBlock(
  ctx: restate.WorkflowContext,
  issueNumber: number,
  prNumber: number,
  fullRepo: string,
  prefix: string,
) {
  const prompt = `Use the anton-pr-review skill to perform an automated code review on PR ${prNumber} in repo ${fullRepo}.`;
  await llmLoop(ctx, `${prefix}-pr-review-${prNumber}`, issueNumber, prompt, 'pr-review');
}
