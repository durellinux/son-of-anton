export enum IssueState {
  YOLO = 'YOLO',
  NEEDS_PLANNING = 'NEEDS_PLANNING',
  NEEDS_IMPLEMENTATION = 'NEEDS_IMPLEMENTATION',
  WAITING = 'WAITING',
}

export interface IssueComment {
  body: string;
  reactionGroups: {
    content: string;
    users: {
      totalCount: number;
    };
  }[];
}

export interface Issue {
  body: string;
  comments: IssueComment[];
}

export interface PullRequest {
  number: number;
  reviewDecision: string;
  headRefName: string;
}

export function determineIssueState(issue: Issue): IssueState {
  if (issue.body.includes('#yolo')) {
    return IssueState.YOLO;
  }

  const planComments = issue.comments.filter(c => c.body.endsWith('#son-of-anton-plan'));
  if (planComments.length === 0) {
    return IssueState.NEEDS_PLANNING;
  }

  const lastPlanComment = planComments[planComments.length - 1];
  
  const thumbsUp = lastPlanComment.reactionGroups.find(r => r.content === 'THUMBS_UP')?.users.totalCount || 0;
  const thumbsDown = lastPlanComment.reactionGroups.find(r => r.content === 'THUMBS_DOWN')?.users.totalCount || 0;

  if (thumbsUp > 0) {
    return IssueState.NEEDS_IMPLEMENTATION;
  }

  if (thumbsDown > 0) {
    return IssueState.NEEDS_PLANNING;
  }

  return IssueState.WAITING;
}

export function determinePRState(pr: PullRequest): IssueState {
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    return IssueState.NEEDS_IMPLEMENTATION;
  }

  return IssueState.WAITING;
}
