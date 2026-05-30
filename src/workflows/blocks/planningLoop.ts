// Iterate planning until plan is approved
import * as restate from "@restatedev/restate-sdk";
import {fetchIssueState, updateRepository} from "../actions/issuesActions";
import {IssueState} from "../../../issue-state";
import {buildPlanningPrompt, commitPlan, deletePlanningSession, thumbsUpPlan} from "../actions/planActions";
import {executeGemini} from "../gemini";

const MAX_PLAN_ITERATIONS = 1000;

export async function planningLoop(
    ctx: restate.WorkflowContext,
    issueNumber: number,
    issueRepo: string,
    title: string,
    issueUrl: string,
    workflowUrl: string,
    prefix: string = 'planning-loop',
    maxIterations: number = MAX_PLAN_ITERATIONS) {

    if (maxIterations <= 0 || maxIterations > MAX_PLAN_ITERATIONS) {
        maxIterations = MAX_PLAN_ITERATIONS;
    }

    let iteration = 0;
    while (iteration < maxIterations) {
        iteration++;

        const { state } = await ctx.run(`${prefix}-fetch-initial-issue-state-${iteration}`, () => fetchIssueState(issueNumber, issueRepo));

        if (state === IssueState.CLOSED || state === IssueState.MERGED || state === IssueState.WAITING_PR_REVIEW) {
            return;
        }


        if (state !== IssueState.WAITING) {
            await ctx.run(`${prefix}-update-repository-initial-${iteration}`, () => updateRepository(issueNumber, title, issueUrl, state, workflowUrl));

            const prompt = buildPlanningPrompt(issueNumber, issueRepo, state);
            await ctx.run(`${prefix}-execute-gemini-${iteration}`, () => executeGemini(issueNumber, prompt, 'plan'));

            // Update state after planning
            const { state: finalState } = await ctx.run(`${prefix}-fetch-final-issue-state-${iteration}`, () => fetchIssueState(issueNumber, issueRepo));
            await ctx.run(`${prefix}-update-repository-final-${iteration}`, () => updateRepository(issueNumber, title, issueUrl, finalState, workflowUrl));

            if (finalState === IssueState.NEEDS_IMPLEMENTATION) {
                const githubComment = await ctx.run(`${prefix}-commit-plan-${iteration}`, () => commitPlan(issueNumber, issueRepo))
                await ctx.run(`${prefix}-thumbs-up-plan-${iteration}`, () => thumbsUpPlan(issueRepo, githubComment));
                await ctx.run(`${prefix}-remove-local-planning-${iteration}`, () => deletePlanningSession(issueNumber));
                return;
            }
        }

        await ctx.sleep(5 * 60 * 1000);
    }

    throw new Error(`Planning loop exceeded maximum iterations: ${maxIterations}`);
}