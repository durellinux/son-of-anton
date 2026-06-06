import * as restate from '@restatedev/restate-sdk';
import { fetchIssueDetails, updateRepository } from './actions/issuesActions';
import { setupWorkspace } from './actions/workspaceActions';
import { geminiLoop } from './blocks/geminiLoop';
import { labelBootstrappingBlock } from './blocks/labelBootstrappingBlock';
import { IssueState, PlanningSessionStatus } from '../../issueState';
import { FileSystemIssueRepository } from '../repositories/fileSystemIssueRepository';
import { commitPlan } from './actions/planActions';

const repository = new FileSystemIssueRepository();

export const implementationAgentWorkflow = restate.workflow({
  name: 'ImplementationAgentWorkflow',
  handlers: {
    run: async (
      ctx: restate.WorkflowContext,
      params: { number: number; title: string; url: string; repository: string },
    ) => {
      const { number: issueNumber, repository: issueRepo } = params;
      const workflowUrl = `http://localhost:8080/visualize/ImplementationAgentWorkflow/${ctx.key}`;

      await labelBootstrappingBlock(ctx, issueRepo);

      // 1. Initial Update
      await ctx.run('initial-update', () =>
        updateRepository(
          issueNumber,
          params.title,
          params.url,
          IssueState.NEEDS_PLANNING,
          workflowUrl,
        ),
      );

      // 2. Setup Workspace
      const ghIssue = await ctx.run('fetch-github-details', () =>
        fetchIssueDetails(issueNumber, issueRepo),
      );
      await ctx.run('setup-workspace', () =>
        setupWorkspace(issueNumber, issueRepo, ghIssue.branch),
      );

      // 3. Research & Plan
      const planPrompt = `follow the anton-plan skill flow for issue ${issueNumber} on the repo ${issueRepo}`;
      await geminiLoop(ctx, 'execute-planning', issueNumber, planPrompt, 'plan');

      // 4. Commit Plan to GitHub
      await ctx.run('commit-plan', () => commitPlan(issueNumber, issueRepo));

      // 5. Update state to WAITING_PLAN_REVIEW
      await ctx.run('update-waiting-approval', () =>
        updateRepository(issueNumber, params.title, params.url, IssueState.WAITING, workflowUrl),
      );

      // 6. Await Human Approval
      const approvalPromise = ctx.promise<boolean>('implementation-approval');
      const approved = await approvalPromise;

      if (!approved) {
        await ctx.run('update-rejected', async () => {
          const session = await repository.getPlanningSession(issueNumber);
          if (session) {
            session.status = PlanningSessionStatus.NEEDS_REVISION;
            await repository.savePlanningSession(session as any);
          }
        });
        return { status: 'rejected' };
      }

      // 7. Update status to Approved/Implementing
      await ctx.run('update-approved', async () => {
        const session = await repository.getPlanningSession(issueNumber);
        if (session) {
          session.status = PlanningSessionStatus.APPROVED;
          await repository.savePlanningSession(session as any);
        }
      });

      await ctx.run('update-implementing', () =>
        updateRepository(
          issueNumber,
          params.title,
          params.url,
          IssueState.NEEDS_IMPLEMENTATION,
          workflowUrl,
        ),
      );

      // 8. Implement & Open PR
      const implementPrompt = `follow the anton-implement skill flow for issue ${issueNumber} on the repo ${issueRepo}.
IMPORTANT: After opening the PR, make sure to remove the 'ready type:task' label from the issue.`;
      await geminiLoop(ctx, 'execute-implementation', issueNumber, implementPrompt, 'implement');

      // 9. Final Update
      await ctx.run('update-final', () =>
        updateRepository(
          issueNumber,
          params.title,
          params.url,
          IssueState.WAITING_PR_REVIEW,
          workflowUrl,
        ),
      );

      return { status: 'completed' };
    },
  },
});
