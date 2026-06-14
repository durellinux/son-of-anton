import * as restate from '@restatedev/restate-sdk';
import { fetchConnectedPRs } from './actions/issuesActions';
import { prReviewerBlock } from './blocks/prReviewerBlock';
import { prShepherdBlock } from './blocks/prShepherdBlock';

export const prLifecycleWorkflow = restate.workflow({
  name: 'PrLifecycleWorkflow',
  handlers: {
    run: async (
      ctx: restate.WorkflowContext,
      params: { number: number; title: string; url: string; repository: string },
    ) => {
      const issueNumber = params.number;
      const repository = params.repository;

      const prNumbers = await ctx.run('fetch-connected-prs', () =>
        fetchConnectedPRs(issueNumber, repository),
      );

      if (prNumbers.length === 0) {
        // No connected PRs found
        return;
      }

      // Track all PRs in parallel
      const prTasks = prNumbers.map(async (prNumber) => {
        // Run review
        await prReviewerBlock(ctx, issueNumber, prNumber, repository);

        // Run shepherd
        return await prShepherdBlock(ctx, issueNumber, prNumber, repository);
      });

      await Promise.all(prTasks);
    },
  },
});
