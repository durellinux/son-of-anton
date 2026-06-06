import * as restate from '@restatedev/restate-sdk';
import { fetchIssueState, updateRepository } from './actions/issuesActions';
import { findPullRequest } from './actions/workspaceActions';
import { geminiLoop } from './blocks/geminiLoop';
import { prReviewLoop } from './blocks/prReviewLoop';
import { labelBootstrappingBlock } from './blocks/labelBootstrappingBlock';

export const epicSpecificationV1 = restate.workflow({
  name: 'EpicSpecificationV1',
  handlers: {
    run: async (
      ctx: restate.WorkflowContext,
      params: { number: number; title: string; url: string; repository: string },
    ) => {
      const { number: issueNumber, repository: issueRepo } = params;
      const workflowUrl = `http://localhost:8080/visualize/EpicSpecificationV1/${ctx.key}`;

      await labelBootstrappingBlock(ctx, issueRepo);

      const { state } = await ctx.run('fetch-initial-state', () =>
        fetchIssueState(issueNumber, issueRepo),
      );

      await ctx.run('update-repository-initial', () =>
        updateRepository(issueNumber, params.title, params.url, state, workflowUrl),
      );

      const prompt = `follow the anton-epic-spec skill flow for issue ${issueNumber} on the repo ${issueRepo}`;
      await geminiLoop(ctx, 'execute-epic-spec', issueNumber, prompt, 'epic-spec');

      // After opening the PR, wait for review/merge
      const { prNumber, prUrl } = await ctx.run('find-pr', () =>
        findPullRequest(issueNumber, issueRepo),
      );

      const finalState = await prReviewLoop(ctx, prNumber, prUrl);

      await ctx.run('update-repository-final', () =>
        updateRepository(issueNumber, params.title, params.url, finalState, workflowUrl),
      );
    },
  },
});
