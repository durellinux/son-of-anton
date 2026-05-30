import * as restate from "@restatedev/restate-sdk";
import {IssueState} from '../../issue-state';
import {executeGemini} from "./gemini";
import {fetchIssueState, updateRepository} from "./actions/issuesActions";
import {buildPlanningPrompt, commitPlan, deletePlanningSession, thumbsUpPlan} from "./actions/planActions";

export const PlanWorkflow = restate.workflow({
  name: "PlanWorkflow",
  handlers: {
    run: async (ctx: restate.WorkflowContext, params: { number: number, title: string, url: string, repository: string, iteration: number }) => {
      const { number: issueNumber, repository: issueRepo, iteration } = params;
      const workflowUrl = `http://localhost:8080/visualize/PlanWorkflow/${ctx.key}`;

      const { state } = await ctx.run("fetch-issue-state", () => fetchIssueState(issueNumber, issueRepo));

      await ctx.run("update-repository", () => updateRepository(issueNumber, params.title, params.url, state, workflowUrl));

      if (state === IssueState.CLOSED || state === IssueState.MERGED || state === IssueState.WAITING_PR_REVIEW) {
        return;
      }

      const prompt = buildPlanningPrompt(issueNumber, issueRepo, state);
      await ctx.run("execute-gemini", () => executeGemini(issueNumber, prompt, 'plan'));

      // Update state after planning
      const { state: finalState } = await ctx.run("fetch-issue-state-final", () => fetchIssueState(issueNumber, issueRepo));

      if (finalState === IssueState.NEEDS_IMPLEMENTATION) {
          const githubComment = await ctx.run("commit-plan", () => commitPlan(issueNumber, issueRepo))
          await ctx.run("thumbs-up-plan", () => thumbsUpPlan(issueRepo, githubComment));
          await ctx.run("remove-local-planning", () => deletePlanningSession(issueNumber));
      }

      await ctx.run("update-repository-final", () => updateRepository(issueNumber, params.title, params.url, finalState, workflowUrl));
    }
  }
});
