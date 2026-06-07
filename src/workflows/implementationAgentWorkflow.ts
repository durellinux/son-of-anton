import * as restate from '@restatedev/restate-sdk';
import { updateRepository, removeLabel } from './actions/issuesActions';
import { IssueState, PlanningSessionStatus } from '../../issueState';
import { buildPlanningPrompt, commitPlan, updatePlanningSessionStatus } from './actions/planActions';
import { geminiLoop } from './blocks/geminiLoop';

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
      let approved = false;
      let iteration = 1;
      while (!approved) {
        // Research and Planning
        const prompt = buildPlanningPrompt(issueNumber, issueRepo, IssueState.NEEDS_PLANNING);
        await geminiLoop(ctx, `planning-gemini-it${iteration}`, issueNumber, prompt, 'plan');

        // Commit plan to GitHub
        await ctx.run(`commit-plan-it${iteration}`, () => commitPlan(issueNumber, issueRepo));

        // Update repository status to WAITING (Waiting for Plan Review)
        await ctx.run(`update-status-waiting-it${iteration}`, () =>
          updateRepository(issueNumber, params.title, params.url, IssueState.WAITING, workflowUrl),
        );

        // Await human approval
        approved = await ctx.promise<boolean>('implementation-approval');

        if (!approved) {
          // Update planning session status to NEEDS_REVISION
          await ctx.run(`update-session-revision-it${iteration}`, () =>
            updatePlanningSessionStatus(issueNumber, PlanningSessionStatus.NEEDS_REVISION),
          );
          // Loop continues to allow for plan revision
          iteration++;
        } else {
          // Update planning session status to APPROVED
          await ctx.run(`update-session-approved-it${iteration}`, () =>
            updatePlanningSessionStatus(issueNumber, PlanningSessionStatus.APPROVED),
          );
        }
      }

      // 2. Implementation Phase
      // Update repository status to NEEDS_IMPLEMENTATION
      await ctx.run('update-status-implementing', () =>
        updateRepository(
          issueNumber,
          params.title,
          params.url,
          IssueState.NEEDS_IMPLEMENTATION,
          workflowUrl,
        ),
      );

      // Execute implementation
      const impPrompt = `follow the anton-implement skill flow for issue ${issueNumber} on the repo ${issueRepo}`;
      await geminiLoop(ctx, 'implementation-gemini', issueNumber, impPrompt, 'implement');

      // Call the new removeLabel action
      await ctx.run('remove-ready-label', () =>
        removeLabel(issueNumber, issueRepo, 'ready type:task'),
      );

      // Finalize by updating repository status to WAITING_PR_REVIEW
      await ctx.run('update-status-waiting-pr-review', () =>
        updateRepository(
          issueNumber,
          params.title,
          params.url,
          IssueState.WAITING_PR_REVIEW,
          workflowUrl,
        ),
      );
    },
  },
});
