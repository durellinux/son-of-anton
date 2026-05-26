import * as restate from "@restatedev/restate-sdk";
import { execa } from 'execa';
import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { determineIssueState, IssueState, Issue as GH_Issue } from '../../issue-state';
import { FileSystemIssueRepository } from '../repositories/FileSystemIssueRepository';
import { IssueStatus, Issue } from '../api';

const repository = new FileSystemIssueRepository();

function mapStateToStatus(state: IssueState): IssueStatus {
    switch (state) {
        case IssueState.YOLO: return IssueStatus.YOLO;
        case IssueState.NEEDS_PLANNING: return IssueStatus.PLANNING;
        case IssueState.NEEDS_IMPLEMENTATION: return IssueStatus.IMPLEMENTING;
        case IssueState.WAITING: return IssueStatus.WAITING_PLAN_REVIEW;
        default: return IssueStatus.PLANNING;
    }
}

async function executeGemini(id: number, prompt: string) {
  // Session Logging
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sessionDir = path.join('.anton', 'sessions', String(id));
  await mkdir(sessionDir, { recursive: true });
  
  const sessionFilePath = path.join(sessionDir, `${timestamp}.txt`);
  const logStream = createWriteStream(sessionFilePath);

  const subprocess = execa('gemini', [
    '-p', prompt,
    '--sandbox', 'true',
    '--approval-mode', 'yolo'
  ]);

  // Hook into the stream
  subprocess.stdout?.on('data', (chunk) => {
      const data = chunk.toString();
      logStream.write(data);
  });

  // Hook into the stream
  subprocess.stderr?.on('data', (chunk) => {
      const data = chunk.toString();
      logStream.write(data);
  });

  try {
    await subprocess;
  } finally {
    logStream.end();
  }
}

export const IssueWorkflow = restate.workflow.workflow("IssueWorkflow", {
  run: async (ctx: restate.workflow.WorkflowContext, params: { number: number, title: string, url: string, repository: string }) => {
    const { number: issueNumber, repository: issueRepo } = params;

    while (true) {
      const { state } = await ctx.run("fetch-issue-state", async () => {
        const localPlanningSession = await repository.getPlanningSession(issueNumber);
        const { stdout: issueDetailsJson } = await execa('gh', ['issue', 'view', String(issueNumber), '-R', issueRepo, '--json', 'body,comments']);
        const issueDetails = JSON.parse(issueDetailsJson) as GH_Issue;

        const state = determineIssueState(issueDetails, localPlanningSession as any);
        
        // If planning session is approved, post to GitHub and clear local session
        if (localPlanningSession && localPlanningSession.status === 'approved') {
          const lastStep = localPlanningSession.history[localPlanningSession.history.length - 1];
          if (lastStep) {
            const commentBody = `${lastStep.plan}\n\n#son-of-anton-plan`;
            const { stdout: commentJson } = await execa('gh', ['api', `repos/${issueRepo}/issues/${issueNumber}/comments`, '-f', `body=${commentBody}`]);
            const comment = JSON.parse(commentJson);
            await execa('gh', ['api', `repos/${issueRepo}/issues/comments/${comment.id}/reactions`, '-f', 'content=+1']);
            
            // Delete the local planning session as it is now on GitHub
            await repository.deletePlanningSession(issueNumber);
          }
        }

        return { state };
      });

      await ctx.run("update-repository", async () => {
        const issue: Issue = {
            number: issueNumber,
            title: params.title,
            url: params.url,
            status: mapStateToStatus(state),
            workflowUrl: `http://localhost:8080/visualize/IssueWorkflow/${ctx.key}`
        };
        await repository.saveIssue(issue);
      });

      if (state === IssueState.WAITING) {
        // Wait for an external event (e.g. comment or approval)
        await ctx.promise<void>("event").promise();
        continue;
      }

      let prompt = '';
      switch (state) {
        case IssueState.YOLO:
          prompt = `Research, plan and implement the fix for issue ${issueNumber} on the repo ${issueRepo}. Follow the anton-plan and anton-implement skills workflow.`;
          break;
        case IssueState.NEEDS_PLANNING:
          prompt = `follow the anton-plan skill flow for issue ${issueNumber} on the repo ${issueRepo}`;
          break;
        case IssueState.NEEDS_IMPLEMENTATION:
          prompt = `follow the anton-implement skill flow for issue ${issueNumber} on the repo ${issueRepo}`;
          break;
      }

      if (prompt) {
        await ctx.run("execute-gemini", async () => {
           await executeGemini(issueNumber, prompt);
        });
      }
    }
  },

  signalEvent: async (ctx: restate.workflow.SharedWorkflowContext) => {
    ctx.promise<void>("event").resolve();
  }
});
