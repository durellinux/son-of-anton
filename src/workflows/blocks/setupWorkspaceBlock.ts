import * as restate from '@restatedev/restate-sdk';
import { setupWorkspace, RebaseConflictError } from '../actions/workspaceActions';
import { geminiLoop } from './geminiLoop';

export async function setupWorkspaceBlock(
  ctx: restate.WorkflowContext,
  issueNumber: number,
  issueRepo: string,
  branch: string | undefined,
  prefix: string = 'setup-workspace',
) {
  try {
    await ctx.run(`${prefix}-setup-workspace`, () => setupWorkspace(issueNumber, issueRepo, branch));
  } catch (error: any) {
    if (error instanceof RebaseConflictError || error.name === 'RebaseConflictError') {
      const conflictDetails = error.conflictDetails || (error as any).message;
      const prompt = `There is a rebase conflict while setting up the workspace for issue ${issueNumber} on repo ${issueRepo}${branch ? ` on branch ${branch}` : ''}.

Conflict details:
${conflictDetails}

Goal: Resolve the conflicts and successfully complete the rebase.

Instructions:
1. Navigate to the repository in the workspace: workspaces/${issueRepo}
2. Identify the files with conflicts.
3. For each file, resolve the conflicts.
4. Stage the resolved files: git add <file>
5. Continue the rebase: git rebase --continue
6. If further conflicts occur, repeat the process until the rebase is complete.

Once the rebase is finished, summarize what was done.`;

      await geminiLoop(ctx, `${prefix}-resolve-rebase-conflict`, issueNumber, prompt, 'resolve-conflict');
    } else {
      throw error;
    }
  }
}
