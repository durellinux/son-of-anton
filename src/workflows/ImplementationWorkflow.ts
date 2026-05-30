import * as restate from "@restatedev/restate-sdk";
import { IssueState } from '../../issue-state';
import {executeGemini} from "./gemini";
import {fetchIssueState, updateRepository} from "./actions/issuesActions";
import {implementationBlock} from "./blocks/implementationBlock";

export const ImplementationWorkflow = restate.workflow({
  name: "ImplementationWorkflow",
  handlers: {
    run: async (ctx: restate.WorkflowContext, params: { number: number, title: string, url: string, repository: string }) => {
      const { number: issueNumber, repository: issueRepo } = params;
      const workflowUrl = `http://localhost:8080/visualize/ImplementationWorkflow/${ctx.key}`;

      await implementationBlock(ctx, issueNumber, issueRepo, params.title, params.url, workflowUrl);
    }
  }
});
