import * as restate from '@restatedev/restate-sdk';
import { fetchIssueDetails, fetchIssueState, updateRepository } from './actions/issuesActions';
import { findPullRequest } from './actions/workspaceActions';
import { planningLoop } from './blocks/planningLoop';
import { implementationBlock } from './blocks/implementationBlock';
import { prReviewLoop } from './blocks/prReviewLoop';
import { labelBootstrappingBlock } from './blocks/labelBootstrappingBlock';
import { setupWorkspaceBlock } from './blocks/setupWorkspaceBlock';

export const issueWorkflowV1 = restate.workflow({
  name: 'IssueWorkflowV1',
  handlers: {
    run: async (
      ctx: restate.WorkflowContext,
      params: { number: number; title: string; url: string; repository: string },
    ) => {
      const { number: issueNumber, repository: issueRepo } = params;
      const workflowUrl = `http://localhost:8080/visualize/IssueWorkflowV1/${ctx.key}`;

      await labelBootstrappingBlock(ctx, issueRepo);

      const { state } = await ctx.run('fetch-initial-state', () =>
        fetchIssueState(issueNumber, issueRepo),
      );
      const ghIssue = await ctx.run('fetch-github-details', () =>
        fetchIssueDetails(issueNumber, issueRepo),
      );
      await ctx.run('create-issue', () =>
        updateRepository(issueNumber, params.title, params.url, state, workflowUrl),
      );
      await setupWorkspaceBlock(ctx, issueNumber, issueRepo, ghIssue.branch);

      await planningLoop(ctx, issueNumber, issueRepo, params.title, params.url, workflowUrl);
      await implementationBlock(ctx, issueNumber, issueRepo, params.title, params.url, workflowUrl);

      const { prNumber, prUrl } = await ctx.run('find-pr', () =>
        findPullRequest(issueNumber, issueRepo),
      );

      const finalState = await prReviewLoop(ctx, prNumber, prUrl);
      await ctx.run('update-issue-state', () =>
        updateRepository(issueNumber, params.title, params.url, finalState, workflowUrl),
      );
    },
    submitApproval: async (ctx: restate.WorkflowSharedContext, req: { iteration: number }) => {
      ctx.promise<void>(`approval-${req.iteration}`).resolve();
    },
  },
});
