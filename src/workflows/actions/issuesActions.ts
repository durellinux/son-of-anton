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