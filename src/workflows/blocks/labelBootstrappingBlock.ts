import * as restate from '@restatedev/restate-sdk';
import { ensureLabels } from '../actions/labelActions';

export async function labelBootstrappingBlock(ctx: restate.WorkflowContext, repo: string) {
  await ctx.run('bootstrap-labels', () => ensureLabels(repo));
}
