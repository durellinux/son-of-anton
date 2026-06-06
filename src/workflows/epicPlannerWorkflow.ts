import * as restate from '@restatedev/restate-sdk';
import { readAdrFile, createGitHubIssue } from './actions/epicActions';
import { geminiLoop } from './blocks/geminiLoop';
import { labelBootstrappingBlock } from './blocks/labelBootstrappingBlock';
import { FileSystemIssueRepository } from '../repositories/fileSystemIssueRepository';
import { PlanningSessionStatus } from '../../issueState';

const repository = new FileSystemIssueRepository();

export const epicPlannerWorkflow = restate.workflow({
  name: 'EpicPlannerWorkflow',
  handlers: {
    run: async (
      ctx: restate.WorkflowContext,
      params: { epicIssueNumber: number; repository: string; adrPath: string },
    ) => {
      const { epicIssueNumber, repository: repo, adrPath } = params;

      await labelBootstrappingBlock(ctx, repo);

      // 1. Read ADR/Spec
      const adrContent = await ctx.run('read-adr', () =>
        readAdrFile(epicIssueNumber, repo, adrPath),
      );

      // 2. Propose task breakdown via Gemini
      const prompt = `
Given the following ADR/Specification:
---
${adrContent}
---
Propose a breakdown of tasks to implement this Epic.
Return ONLY a JSON array of objects, each with 'title' and 'body' fields.
Example:
[
  { "title": "Implement feature A", "body": "Details about A..." },
  { "title": "Implement feature B", "body": "Details about B..." }
]
`;

      const tasksJson = await geminiLoop(
        ctx,
        'propose-tasks',
        epicIssueNumber,
        prompt,
        'epic-proposal',
      );

      // Try to parse the JSON. If it fails, we might need a retry or a human to fix it.
      // For now, let's assume it works or we'll handle it simply.
      let tasks: { title: string; body: string }[] = [];
      try {
        // Extract JSON if Gemini wrapped it in markdown
        const jsonMatch = tasksJson.match(/\[[\s\S]*\]/);
        tasks = JSON.parse(jsonMatch ? jsonMatch[0] : tasksJson);
      } catch (e) {
        throw new Error(`Failed to parse tasks JSON from Gemini: ${tasksJson}`, { cause: e });
      }

      // 3. Save proposal for human approval
      // We reuse the planning session structure
      await ctx.run('save-proposal', async () => {
        const session = {
          number: epicIssueNumber,
          status: PlanningSessionStatus.WAITING_APPROVAL,
          history: [
            {
              plan: JSON.stringify(tasks, null, 2),
              timestamp: new Date().toISOString(),
            },
          ],
        };
        await repository.savePlanningSession(session as any);
      });

      // 4. Wait for human approval via ctx.promise
      // The API endpoint /issues/:number/planning/approve will need to resolve this promise.
      const approvalPromise = ctx.promise<boolean>('epic-approval');
      const approved = await approvalPromise;

      if (!approved) {
        // If rejected, we could loop back or just end.
        // For now, let's just end if not approved.
        return { status: 'rejected' };
      }

      // 5. Create individual GitHub issues
      const createdIssues: number[] = [];
      for (const [index, task] of tasks.entries()) {
        const issueNumber = await ctx.run(`create-issue-${index}`, () =>
          createGitHubIssue(repo, task.title, task.body, ['type:task', `epic:${epicIssueNumber}`]),
        );
        createdIssues.push(issueNumber);
      }

      return { status: 'completed', createdIssues };
    },
  },
});
