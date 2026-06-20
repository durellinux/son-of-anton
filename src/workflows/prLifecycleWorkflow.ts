import * as restate from '@restatedev/restate-sdk';
import { fetchConnectedPRs, updateRepository } from './actions/issuesActions';
import { prReviewerBlock } from './blocks/prReviewerBlock';
import { prShepherdBlock } from './blocks/prShepherdBlock';
import { IssueState } from '../../issueState';

const MAX_PLAN_ITERATIONS = 1000;

export const prLifecycleWorkflow = restate.workflow({
  name: 'PrLifecycleWorkflow',
  handlers: {
    run: async (
      ctx: restate.WorkflowContext,
      params: { number: number; title: string; url: string; repository: string },
    ) => {
      const issueNumber = params.number;
      const repository = params.repository;
      const workflowUrl = `http://localhost:8080/visualize/PrLifecycleWorkflow/${ctx.key}`;

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
        await prReviewerBlock(ctx, issueNumber, prNumber, repository, 'pr-lifecycle');
      });

      await Promise.all(prTasks);

      let iteration = 0;
      let allCompleted = false;

      while (iteration < MAX_PLAN_ITERATIONS && !allCompleted) {
        iteration++;

        const shepherdTasks = prNumbers.map(async (prNumber) => {
          return await prShepherdBlock(
            ctx,
            issueNumber,
            prNumber,
            repository,
            iteration,
            'pr-lifecycle',
          );
        });

        const results = await Promise.all(shepherdTasks);

        let maxWaitTimeMs = 0;
        let conflictDetected = false;
        allCompleted = true;

        for (const result of results) {
          if (
            result.state !== IssueState.MERGED &&
            result.state !== IssueState.CLOSED &&
            result.state !== IssueState.FAILED
          ) {
            allCompleted = false;
          }
          if (result.state === IssueState.CONFLICT_DETECTED) {
            conflictDetected = true;
          }
          if (result.waitTimeMs > maxWaitTimeMs) {
            maxWaitTimeMs = result.waitTimeMs;
          }
        }

        if (conflictDetected) {
          await ctx.run(`set-conflict-${iteration}`, () =>
            updateRepository(
              issueNumber,
              params.title,
              params.url,
              IssueState.CONFLICT_DETECTED,
              workflowUrl,
            ),
          );
        }

        if (allCompleted) {
          break;
        }

        if (maxWaitTimeMs > 0) {
          await ctx.sleep(maxWaitTimeMs);
        }
      }
    },
  },
  options: {
    inactivityTimeout: { minutes: 60 },
    abortTimeout: { minutes: 60 },
  },
});
