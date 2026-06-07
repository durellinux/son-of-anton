import * as restate from '@restatedev/restate-sdk';
import {
  fetchIssueDetails,
  createGitHubIssue,
  addLabel,
  removeLabel,
  updateRepository,
} from './actions/issuesActions';
import { setupWorkspaceBlock } from './blocks/setupWorkspaceBlock';
import { geminiLoop } from './blocks/geminiLoop';
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

      // Transition labels
      await ctx.run('transition-labels', async () => {
        await addLabel(issueNumber, issueRepo, 'status:planning');
      });

      await ctx.run('update-repo-planning', () =>
        updateRepository(issueNumber, params.title, params.url, IssueState.WAITING, workflowUrl),
      );

      const ghIssue = await ctx.run('fetch-github-details', () =>
        fetchIssueDetails(issueNumber, issueRepo),
      );

      // Setup workspace to access ADRs
      await setupWorkspaceBlock(ctx, issueNumber, issueRepo, ghIssue.branch);

      const prompt = `You are an expert software architect. Read the Epic issue #${issueNumber} and the ADRs in docs/adr/ to understand the requirements.
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

      const geminiOutput = await geminiLoop(ctx, 'propose-tasks', issueNumber, prompt, 'planning');

      // Parse tasks from gemini output
      const tasks = await ctx.run('parse-tasks', () => {
        const jsonMatch = geminiOutput.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Could not find JSON in Gemini output');
        return JSON.parse(jsonMatch[0]).tasks as { title: string; body: string }[];
      });

      // Save to repository for human review
      await ctx.run('save-proposal', async () => {
        await repository.savePlanningSession({
          number: issueNumber,
          status: 'waiting_approval' as any,
          history: [
            {
              plan: geminiOutput,
              timestamp: new Date().toISOString(),
            },
          ],
        } as any);
      });

      // Wait for human approval via ctx.promise
      await ctx.promise<void>('epic-approval');

      // Create tasks
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        await ctx.run(`create-task-${i}`, () =>
          createGitHubIssue(issueRepo, `[Task] ${task.title}`, `${task.body}\n\nPart of epic #${issueNumber}`, [
            'type:task',
            'status:triage',
            'son-of-anton',
          ]),
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
  },
});
