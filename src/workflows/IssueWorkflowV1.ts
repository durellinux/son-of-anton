import * as restate from "@restatedev/restate-sdk";
import {IssueState} from '../../issue-state';
import {executeGemini} from "./gemini";
import {fetchIssueState, updateRepository} from "./actions/issuesActions";
import {setupWorkspace, findPullRequest} from "./actions/workspaceActions";
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

            const { state } = await ctx.run('fetch-initial-state', () => fetchIssueState(issueNumber, issueRepo));
            await ctx.run('create-issue', () => updateRepository(issueNumber, params.title, params.url, state, workflowUrl));
            await ctx.run('setup-workspace', () => setupWorkspace(issueNumber, issueRepo));

            await planningLoop(ctx, issueNumber, issueRepo, params.title, params.url, workflowUrl);
            await implementationBlock(ctx, issueNumber, issueRepo, params.title, params.url, workflowUrl);

            const {prNumber, prUrl} = await ctx.run('find-pr', () => findPullRequest(issueNumber, issueRepo));

            await prReviewLoop(ctx, prNumber, prUrl);
        }
    }
});
