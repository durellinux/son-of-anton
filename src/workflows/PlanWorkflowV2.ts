import * as restate from "@restatedev/restate-sdk";
import {IssueState} from '../../issue-state';
import {executeGemini} from "./gemini";
import {fetchIssueState, updateRepository} from "./actions/issuesActions";
import {buildPlanningPrompt, commitPlan, deletePlanningSession, thumbsUpPlan} from "./actions/planActions";
import {planningLoop} from "./blocks/planningLoop";

export const PlanWorkflowV2 = restate.workflow({
  name: "PlanWorkflowV2",
  handlers: {
    run: async (ctx: restate.WorkflowContext, params: { number: number, title: string, url: string, repository: string }) => {
      const { number: issueNumber, repository: issueRepo } = params;
      const workflowUrl = `http://localhost:8080/visualize/PlanWorkflowV2/${ctx.key}`;

      await planningLoop(ctx, issueNumber, issueRepo, params.title, params.url, workflowUrl);
    }
  }
});
