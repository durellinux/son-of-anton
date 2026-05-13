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

export interface Session {
  id: string;
  type: "planning" | "implementing" | "addressing-review";
  timestamp: string; // ISO 8601
  status: "success" | "failure";
}

export interface Paged<T> {
  items: T[];
  nextCursor?: string;
}
