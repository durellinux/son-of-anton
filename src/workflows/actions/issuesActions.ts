import {determineIssueState, Issue as GH_Issue, IssueState} from "../../../issue-state";
import {Issue, IssueStatus} from "../../api";
import {FileSystemIssueRepository} from "../../repositories/FileSystemIssueRepository";
import {execa} from "execa";

const repository = new FileSystemIssueRepository();

function mapStateToStatus(state: IssueState): IssueStatus {
    switch (state) {
        case IssueState.YOLO:
            return IssueStatus.YOLO;
        case IssueState.NEEDS_PLANNING:
            return IssueStatus.PLANNING;
        case IssueState.NEEDS_IMPLEMENTATION:
            return IssueStatus.IMPLEMENTING;
        case IssueState.WAITING_PR_REVIEW:
            return IssueStatus.WAITING_PR_REVIEW;
        case IssueState.WAITING:
            return IssueStatus.WAITING_PLAN_REVIEW;
        case IssueState.CLOSED:
            return IssueStatus.CLOSED;
        case IssueState.MERGED:
            return IssueStatus.DONE;
        default:
            return IssueStatus.PLANNING;
    }
}

export async function fetchIssueState(issueNumber: number, issueRepo: string) {
    const localPlanningSession = await repository.getPlanningSession(issueNumber);
    const {stdout: issueDetailsJson} = await execa('gh', ['issue', 'view', String(issueNumber), '-R', issueRepo, '--json', 'body,comments,state']);
    const issueDetails = JSON.parse(issueDetailsJson) as GH_Issue;

    const state = determineIssueState(issueDetails, localPlanningSession as any);

    // If planning session is approved, post to GitHub and clear local session
    if (localPlanningSession && localPlanningSession.status === 'approved') {
        const lastStep = localPlanningSession.history[localPlanningSession.history.length - 1];
        if (lastStep) {
            const commentBody = `${lastStep.plan}\n\n#son-of-anton-plan`;
            const {stdout: commentJson} = await execa('gh', ['api', `repos/${issueRepo}/issues/${issueNumber}/comments`, '-f', `body=${commentBody}`]);
            const comment = JSON.parse(commentJson);
            await execa('gh', ['api', `repos/${issueRepo}/issues/comments/${comment.id}/reactions`, '-f', 'content=+1']);

            // Delete the local planning session as it is now on GitHub
            await repository.deletePlanningSession(issueNumber);
        }
    }

    return {state};
}

export async function updateRepository(issueNumber: number, title: string, url: string, state: IssueState, workflowUrl: string) {
    const issue: Issue = {
        number: issueNumber,
        title: title,
        url: url,
        status: mapStateToStatus(state),
        workflowUrl,
    };
    await repository.saveIssue(issue);
}