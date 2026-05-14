import { components } from './types';

export type Issue = components['schemas']['Issue'];
export type IssueStatus = components['schemas']['IssueStatus'];
export const IssueStatus = {
  Planning: "Planning",
  WaitingPlanReview: "Waiting Plan review",
  Implementing: "Implementing",
  WaitingPRReview: "Waiting PR review",
  YOLO: "YOLO",
} as const;
export type Session = components['schemas']['Session'];

export interface Paged<T> {
  items: T[];
  nextCursor?: string;
}
