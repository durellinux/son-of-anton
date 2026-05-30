import * as restate from "@restatedev/restate-sdk";
import {IssueState} from '../../issue-state';
import {executeGemini} from "./gemini";
import {fetchPrState} from "./actions/prActions";

export const PRWorkflow = restate.workflow({
  name: "PRWorkflow",
  handlers: {
    run: async (ctx: restate.WorkflowContext, params: { number: number, url: string }) => {
      const { number: prNumber, url: prUrl } = params;
      const urlParts = prUrl.split('/');
      const owner = urlParts[3];
      const repo = urlParts[4];
      const fullRepo = `${owner}/${repo}`;

      const { state, prDetails, unaddressedCommentIds } = await ctx.run("fetch-pr-state", () => fetchPrState(prNumber, fullRepo));

      if (state === IssueState.MERGED || state === IssueState.CLOSED) {
        return;
      }

      if (state === IssueState.NEEDS_IMPLEMENTATION && unaddressedCommentIds.length > 0) {
        await ctx.run("execute-gemini", async () => {
          // Extract issue number from branch name (e.g., anton/30)
          const issueMatch = prDetails.headRefName.match(/anton\/(\d+)/);
          const issueNumber = issueMatch ? issueMatch[1] : `pr-${prNumber}`;
          const issueParam = `for issue ${issueNumber} `;
          const prompt = `use the anton-pr-fix skill flow ${issueParam} for PR ${prNumber} on branch ${prDetails.headRefName} in repo ${fullRepo} with comment IDs ${unaddressedCommentIds.join(', ')}`;
          await executeGemini(prNumber, prompt, 'pr-fix');
        });
      }
    }
  }
});
