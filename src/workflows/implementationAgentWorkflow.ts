import * as restate from '@restatedev/restate-sdk';
import { removeLabel } from './actions/issuesActions';
import { planningLoop } from './blocks/planningLoop';
import { implementationBlock } from './blocks/implementationBlock';

export const implementationAgentWorkflow = restate.workflow({
  name: 'ImplementationAgentWorkflow',
  handlers: {
    run: async (
      ctx: restate.WorkflowContext,
      params: { number: number; title: string; url: string; repository: string },
    ) => {
      const { number: issueNumber, repository: issueRepo } = params;
      const workflowUrl = `http://localhost:8080/visualize/ImplementationAgentWorkflow/${ctx.key}`;

      // 1. Planning and Approval Phase
      await planningLoop(ctx, issueNumber, issueRepo, params.title, params.url, workflowUrl);

      // 2. Implementation Phase
      await implementationBlock(ctx, issueNumber, issueRepo, params.title, params.url, workflowUrl);

      // Call the removeLabel action
      await ctx.run('remove-ready-label', () =>
        removeLabel(issueNumber, issueRepo, 'ready type:task'),
      );
    },
  },
});
