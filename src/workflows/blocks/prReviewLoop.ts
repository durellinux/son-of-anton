import * as restate from "@restatedev/restate-sdk";
import {fetchPrState} from "../actions/prActions";
import {IssueState} from "../../../issue-state";
import {executeGemini} from "../gemini";

const MAX_PLAN_ITERATIONS = 1000;

export async function prReviewLoop(
    ctx: restate.WorkflowContext,
    prNumber: number,
    prUrl: string,
    prefix: string = 'pr-review',
    maxIterations: number = MAX_PLAN_ITERATIONS) {

    const urlParts = prUrl.split('/');
    const owner = urlParts[3];
    const repo = urlParts[4];
    const fullRepo = `${owner}/${repo}`;

    let iteration = 0;
    while (iteration < maxIterations) {
        iteration++;

        const { state, prDetails, unaddressedCommentIds } = await ctx.run(`${prefix}-fetch-pr-state-${iteration}`, () => fetchPrState(prNumber, fullRepo));

        if (state === IssueState.MERGED || state === IssueState.CLOSED) {
            return;
        }

        if (state === IssueState.NEEDS_IMPLEMENTATION && unaddressedCommentIds.length > 0) {
            await ctx.run(`${prefix}-execute-gemini-${iteration}`, async () => {
                // Extract issue number from branch name (e.g., anton/30)
                const issueMatch = prDetails.headRefName.match(/anton\/(\d+)/);
                const issueNumber = issueMatch ? issueMatch[1] : `pr-${prNumber}`;
                const issueParam = `for issue ${issueNumber} `;
                const prompt = `use the anton-pr-fix skill flow ${issueParam} for PR ${prNumber} on branch ${prDetails.headRefName} in repo ${fullRepo} with comment IDs ${unaddressedCommentIds.join(', ')}`;
                await executeGemini(prNumber, prompt, 'pr-fix');
            });
        }

        await ctx.sleep(5 * 60 * 1000);
    }

}