export enum IssueState {
  YOLO = 'YOLO',
  NEEDS_PLANNING = 'NEEDS_PLANNING',
  NEEDS_IMPLEMENTATION = 'NEEDS_IMPLEMENTATION',
  WAITING_PR_REVIEW = 'WAITING_PR_REVIEW',
  WAITING = 'WAITING',
  CLOSED = 'CLOSED',
  MERGED = 'MERGED',
  FAILED = 'FAILED',
}

export interface IssueComment {
  body: string;
  state: string;
  reactionGroups: {
    content: string;
    users: {
      totalCount: number;
    };
  }[];
}

export interface Issue {
  body: string;
  state: string;
  branch?: string;
  comments: IssueComment[];
  pullRequests?: { state: string }[];
}

export interface GHRawIssue {
  body: string;
  state: string;
  closedByPullRequestsReferences: { number: number }[];
  branch?: string;
}

export interface PullRequestBase {
  number: number;
  url: string;
}

export interface PullRequest extends PullRequestBase {
  reviewDecision: string;
  state: string;
  headRefName: string;
}

export interface PRComment {
  id: number;
  body: string;
  state: string;
  reactions: {
    '+1': number;
    [key: string]: any;
  };
}

export enum PlanningSessionStatus {
  WAITING_APPROVAL = 'waiting_approval',
  APPROVED = 'approved',
  NEEDS_REVISION = 'needs_revision',
}

export interface PlanningSession {
  status: PlanningSessionStatus;
}

export function determineIssueState(
  issue: Issue,
  localPlanningSession?: PlanningSession,
): IssueState {
  if (issue.state === 'CLOSED') {
    return IssueState.CLOSED;
  }

  if (
    issue.branch ||
    (issue.pullRequests && issue.pullRequests.some((pr) => pr.state === 'OPEN'))
  ) {
    return IssueState.WAITING_PR_REVIEW;
  }

  if (issue.body.includes('#yolo')) {
    return IssueState.YOLO;
  }

  // If we have a local planning session, it takes precedence over GitHub comments
  if (localPlanningSession) {
    switch (localPlanningSession.status) {
      case PlanningSessionStatus.APPROVED:
        return IssueState.NEEDS_IMPLEMENTATION;
      case PlanningSessionStatus.NEEDS_REVISION:
        return IssueState.NEEDS_PLANNING;
      case PlanningSessionStatus.WAITING_APPROVAL:
        return IssueState.WAITING;
    }
  }

  const planComment = [...issue.comments]
    .reverse()
    .find((c) => c.body.includes('#son-of-anton-plan') && !c.body.startsWith('>'));

  if (planComment) {
    const thumbsUp =
      planComment.reactionGroups.find((rg) => rg.content === 'THUMBS_UP')?.users.totalCount || 0;
    const thumbsDown =
      planComment.reactionGroups.find((rg) => rg.content === 'THUMBS_DOWN')?.users.totalCount || 0;

    if (thumbsUp > 0 && thumbsDown === 0) {
      return IssueState.NEEDS_IMPLEMENTATION;
    }
    if (thumbsDown > 0) {
      return IssueState.NEEDS_PLANNING;
    }
    return IssueState.WAITING;
  }

  return IssueState.NEEDS_PLANNING;
}

export function determinePRState(pr: PullRequest): IssueState {
  if (pr.state === 'MERGED') {
    return IssueState.MERGED;
  }
  if (pr.state === 'CLOSED') {
    return IssueState.CLOSED;
  }

  if (pr.reviewDecision !== 'APPROVED') {
    return IssueState.NEEDS_IMPLEMENTATION;
  }

  return IssueState.WAITING;
}

export function getUnaddressedPRComments(comments: PRComment[]): number[] {
  return comments
    .filter((comment) => (comment.reactions['+1'] || 0) === 0)
    .map((comment) => comment.id);
}
