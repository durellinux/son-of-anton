import * as restate from '@restatedev/restate-sdk';
import { ensureLabels } from '../actions/labelActions';

export async function labelBootstrappingBlock(
  ctx: restate.WorkflowContext,
  repo: string,
  prefix: string = 'label-bootstrapping',
) {
  await ctx.run(`${prefix}-bootstrap-labels`, () => ensureLabels(repo));
}
