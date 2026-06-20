import * as restate from '@restatedev/restate-sdk';
import {
  fetchIssueDetails,
  createGitHubIssue,
  removeLabel,
  updateRepository,
} from './actions/issuesActions';
import { setupWorkspaceBlock } from './blocks/setupWorkspaceBlock';
import { llmLoop } from './blocks/llmLoop';
import { IssueState } from '../../issueState';
import { FileSystemIssueRepository } from '../repositories/fileSystemIssueRepository';

const repository = new FileSystemIssueRepository();

export const epicPlannerWorkflow = restate.workflow({
  name: 'EpicPlannerWorkflow',
  handlers: {
    run: async (
      ctx: restate.WorkflowContext,
      params: { number: number; title: string; url: string; repository: string },
    ) => {
      const { number: issueNumber, repository: issueRepo } = params;
      const workflowUrl = `http://localhost:8080/visualize/EpicPlannerWorkflow/${ctx.key}`;

      await ctx.run('update-repo-planning', () =>
        updateRepository(
          issueNumber,
          params.title,
          params.url,
          IssueState.NEEDS_PLANNING,
          workflowUrl,
        ),
      );

      const ghIssue = await ctx.run('fetch-github-details', () =>
        fetchIssueDetails(issueNumber, issueRepo),
      );

      // Setup workspace to access ADRs
      await setupWorkspaceBlock(ctx, issueNumber, issueRepo, ghIssue.branch);

      let iteration = 0;
      let tasks: { title: string; body: string }[] = [];
      const MAX_ITERATIONS = 100;

      while (iteration < MAX_ITERATIONS) {
        iteration++;

        let prompt = `You are an expert software architect. Read the Epic issue #${issueNumber} and the ADRs in docs/adr/ to understand the requirements.
Epic: ${params.title}
Body: ${ghIssue.body}

Tasks:
1. Find the relevant ADR for this epic in docs/adr/.
2. Based on the ADR and the epic description, propose a list of individual tasks (type:task) to implement this epic.
3. For each task, provide a title and a brief description.
4. Output the task list in JSON format so it can be parsed:
{
  "tasks": [
    { "title": "Task 1", "body": "Description 1" },
    { "title": "Task 2", "body": "Description 2" }
  ]
}
`;

        const sessionBefore = await ctx.run(`fetch-session-before-${iteration}`, () =>
          repository.getPlanningSession(issueNumber),
        );
        if (sessionBefore?.status === 'needs_revision' && sessionBefore.history.length > 0) {
          const lastFeedback = sessionBefore.history[sessionBefore.history.length - 1].feedback;
          if (lastFeedback) {
            prompt += `\nUser feedback from previous iteration:\n${lastFeedback}\nPlease update the plan to incorporate this feedback.`;
          }
        }

        const geminiOutput = await llmLoop(
          ctx,
          `propose-tasks-${iteration}`,
          issueNumber,
          prompt,
          'planning',
        );

        // Parse tasks from gemini output
        tasks = await ctx.run(`parse-tasks-${iteration}`, () => {
          const jsonMatch = geminiOutput.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('Could not find JSON in Gemini output');
          return JSON.parse(jsonMatch[0]).tasks as { title: string; body: string }[];
        });

        // Save to repository for human review
        await ctx.run(`save-proposal-${iteration}`, async () => {
          const currentSession = await repository.getPlanningSession(issueNumber);
          const history = currentSession?.history || [];
          history.push({
            plan: geminiOutput,
            timestamp: new Date().toISOString(),
          });
          await repository.savePlanningSession({
            number: issueNumber,
            status: 'waiting_approval' as any,
            history,
          } as any);
        });

        await ctx.run(`update-status-waiting-${iteration}`, () =>
          updateRepository(issueNumber, params.title, params.url, IssueState.WAITING, workflowUrl),
        );

        // Wait for human approval via ctx.promise
        await ctx.promise<void>(`approval-${iteration}`);

        const sessionAfter = await ctx.run(`check-session-after-${iteration}`, () =>
          repository.getPlanningSession(issueNumber),
        );
        if (sessionAfter?.status === 'approved') {
          break;
        }
      }

      // Create tasks
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        await ctx.run(`create-task-${i}`, () =>
          createGitHubIssue(
            issueRepo,
            `[Task] ${task.title}`,
            `${task.body}\n\nPart of epic #${issueNumber}`,
            ['type:task', 'status:triage', 'son-of-anton'],
          ),
        );
      }

      // Finalize
      await ctx.run('remove-planning-label', () =>
        removeLabel(issueNumber, issueRepo, 'status:planning'),
      );
      await ctx.run('update-final-status', () =>
        updateRepository(issueNumber, params.title, params.url, IssueState.MERGED, workflowUrl),
      );
    },
    submitApproval: async (ctx: restate.WorkflowSharedContext, req: { iteration: number }) => {
      ctx.promise<void>(`approval-${req.iteration}`).resolve();
    },
  },
  options: {
      inactivityTimeout: { minutes: 60 },
      abortTimeout: { minutes: 60 },
  },
});
