import * as restate from "@restatedev/restate-sdk";
import { execa } from 'execa';
import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { determinePRState, IssueState, PullRequest, getUnaddressedPRComments, PRComment } from '../../issue-state';

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

export const PRWorkflow = restate.workflow.workflow("PRWorkflow", {
  run: async (ctx: restate.workflow.WorkflowContext, params: { number: number, url: string }) => {
    const { number: prNumber, url: prUrl } = params;
    const urlParts = prUrl.split('/');
    const owner = urlParts[3];
    const repo = urlParts[4];
    const fullRepo = `${owner}/${repo}`;

    while (true) {
      const { state, prDetails, unaddressedCommentIds } = await ctx.run("fetch-pr-state", async () => {
        const { stdout: prDetailsJson } = await execa('gh', ['pr', 'list', '-R', fullRepo, '--json', 'number,headRefName,url,reviewDecision', '--jq', `.[] | select(.number==${prNumber})`]);
        const prDetails = JSON.parse(prDetailsJson) as PullRequest;

        const state = determinePRState(prDetails);
        
        let unaddressedCommentIds: number[] = [];
        if (state === IssueState.NEEDS_IMPLEMENTATION) {
          const { stdout: commentsJson } = await execa('gh', ['api', `repos/${fullRepo}/pulls/${prNumber}/comments`]);
          const comments = JSON.parse(commentsJson) as PRComment[];
          unaddressedCommentIds = getUnaddressedPRComments(comments);
        }

        return { state, prDetails, unaddressedCommentIds };
      });

      if (state === IssueState.NEEDS_IMPLEMENTATION && unaddressedCommentIds.length > 0) {
        await ctx.run("execute-gemini", async () => {
          // Extract issue number from branch name (e.g., anton/30)
          const issueMatch = prDetails.headRefName.match(/anton\/(\d+)/);
          const issueNumber = issueMatch ? issueMatch[1] : `pr-${prNumber}`;
          const issueParam = `for issue ${issueNumber} `;
          const prompt = `use the anton-pr-fix skill flow ${issueParam} for PR ${prNumber} on branch ${prDetails.headRefName} in repo ${fullRepo} with comment IDs ${unaddressedCommentIds.join(', ')}`;
          await executeGemini(prNumber, prompt);
        });
      }

      // Wait for an external event (e.g. comment or approval)
      await ctx.promise<void>("event").promise();
    }
  },

  signalEvent: async (ctx: restate.workflow.SharedWorkflowContext) => {
    ctx.promise<void>("event").resolve();
  }
});
