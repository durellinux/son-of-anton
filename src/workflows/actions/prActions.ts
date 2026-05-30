import {execa} from "execa";
import {determinePRState, getUnaddressedPRComments, IssueState, PRComment, PullRequest} from "../../../issue-state";

export async function fetchPrState(prNumber: number, fullRepo: string) {
    const {stdout: prDetailsJson} = await execa('gh', ['pr', 'view', String(prNumber), '-R', fullRepo, '--json', 'number,headRefName,url,reviewDecision,state']);
    const prDetails = JSON.parse(prDetailsJson) as PullRequest;

    const state = determinePRState(prDetails);

    let unaddressedCommentIds: number[] = [];
    if (state === IssueState.NEEDS_IMPLEMENTATION) {
        const {stdout: commentsJson} = await execa('gh', ['api', `repos/${fullRepo}/pulls/${prNumber}/comments`]);
        const comments = JSON.parse(commentsJson) as PRComment[];
        unaddressedCommentIds = getUnaddressedPRComments(comments);
    }

    return {state, prDetails, unaddressedCommentIds};
}