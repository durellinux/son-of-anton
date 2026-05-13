export enum IssueStatus {
  Planning = "Planning",
  WaitingPlanReview = "Waiting Plan review",
  Implementing = "Implementing",
  WaitingPRReview = "Waiting PR review",
  YOLO = "YOLO",
}

export interface Issue {
  number: number;
  title: string;
  url: string;
  status: IssueStatus;
  lastPlanCommentUrl?: string;
  prUrl?: string;
  branchName?: string;
  branchUrl?: string;
}
