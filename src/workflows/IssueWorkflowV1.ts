import * as restate from "@restatedev/restate-sdk";
import {IssueState} from '../../issue-state';
import {executeGemini} from "./gemini";
import {fetchIssueState, updateRepository} from "./actions/issuesActions";
import {buildPlanningPrompt, commitPlan, deletePlanningSession, thumbsUpPlan} from "./actions/planActions";
import {planningLoop} from "./blocks/planningLoop";
import {implementationBlock} from "./blocks/implementationBlock";
import {prReviewLoop} from "./blocks/prReviewLoop";

export const IssueWorkflowV1 = restate.workflow({
    name: "IssueWorkflowV1",
    handlers: {
        run: async (ctx: restate.WorkflowContext, params: { number: number, title: string, url: string, repository: string }) => {
            const { number: issueNumber, repository: issueRepo } = params;
            const workflowUrl = `http://localhost:8080/visualize/IssueWorkflowV1/${ctx.key}`;

            // Create issue json: .anton/issues/{issueNumber}
            // Create workspace folder: .anton/workspaces/{issueNumber}/{owner}/
            // Clone repo in workspace folder

            await planningLoop(ctx, issueNumber, issueRepo, params.title, params.url, workflowUrl);
            await implementationBlock(ctx, issueNumber, issueRepo, params.title, params.url, workflowUrl);

            const {prNumber, prUrl} = await ctx.run('find-pr', () => {
                // Compute branch name from branch in repo folder in workspace
                // Get PR id and url for branch: gh search prs --owner {owner} --state open -H {branchName} --json id,url
                const prNumber = 123;
                const prUrl = '';

                return {prNumber, prUrl};
            });

            await prReviewLoop(ctx, prNumber, prUrl);
        }
    }
});
