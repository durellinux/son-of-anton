import * as restate from "@restatedev/restate-sdk";
import {execa} from 'execa';
import {determinePRState, getUnaddressedPRComments, IssueState, PRComment, PullRequest} from '../../issue-state';
import {executeGemini} from "./gemini";

async function fetchPrState(prNumber: number, fullRepo: string) {
    const { stdout: prDetailsJson } = await execa('gh', ['pr', 'view', String(prNumber), '-R', fullRepo, '--json', 'number,headRefName,url,reviewDecision,state']);
    const prDetails = JSON.parse(prDetailsJson) as PullRequest;

    const state = determinePRState(prDetails);
    
    let unaddressedCommentIds: number[] = [];
    if (state === IssueState.NEEDS_IMPLEMENTATION) {
      const { stdout: commentsJson } = await execa('gh', ['api', `repos/${fullRepo}/pulls/${prNumber}/comments`]);
      const comments = JSON.parse(commentsJson) as PRComment[];
      unaddressedCommentIds = getUnaddressedPRComments(comments);
    }

    return { state, prDetails, unaddressedCommentIds };
}

export const PRWorkflow = restate.workflow({
  name: "PRWorkflow",
  handlers: {
    run: async (ctx: restate.WorkflowContext, params: { number: number, url: string }) => {
      const { number: prNumber, url: prUrl } = params;
      const urlParts = prUrl.split('/');
      const owner = urlParts[3];
      const repo = urlParts[4];
      const fullRepo = `${owner}/${repo}`;

      let signalCount = 0;
      while (true) {
        const { state, prDetails, unaddressedCommentIds } = await ctx.run("fetch-pr-state", () => fetchPrState(prNumber, fullRepo));

        if (state === IssueState.MERGED || state === IssueState.CLOSED) {
          break;
        }

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
        const currentSignalCount = (await ctx.get<number>("signalCount")) ?? 0;
        if (signalCount >= currentSignalCount) {
          await ctx.promise<void>(`event-${signalCount + 1}`);
        }

        // Sleep to avoid tight loops if many signals arrive or if state doesn't transition
        await ctx.sleep(30000);
        signalCount = (await ctx.get<number>("signalCount")) ?? 0;
      }
    },

    signalEvent: async (ctx: restate.WorkflowSharedContext) => {
      const count = (await ctx.get<number>("signalCount")) ?? 0;
      const nextCount = count + 1;
      ctx.set("signalCount", nextCount);
      ctx.promise<void>(`event-${nextCount}`).resolve();
    }
  }
});
