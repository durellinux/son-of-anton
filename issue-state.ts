export enum IssueState {
  YOLO = 'YOLO',
  NEEDS_PLANNING = 'NEEDS_PLANNING',
  NEEDS_IMPLEMENTATION = 'NEEDS_IMPLEMENTATION',
  WAITING = 'WAITING',
  CLOSED = 'CLOSED',
  MERGED = 'MERGED',
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
  comments: IssueComment[];
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

export function determineIssueState(issue: Issue, localPlanningSession?: PlanningSession): IssueState {
  if (issue.state === 'CLOSED') {
    return IssueState.CLOSED;
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

  const planComments = issue.comments.filter(c => {
      const body = c.body.trim();
      const lines = body.split('\n');
      const lastLine = lines[lines.length - 1].trim();
      const secondLastLine = lines.length > 1 ? lines[lines.length - 2].trim() : '';
      
      const isPlan = (lastLine.includes('#son-of-anton-plan') && !lastLine.startsWith('>')) || 
                     (secondLastLine.includes('#son-of-anton-plan') && !secondLastLine.startsWith('>'));
      return isPlan;
  });

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
    .filter(comment => (comment.reactions['+1'] || 0) === 0)
    .map(comment => comment.id);
}
