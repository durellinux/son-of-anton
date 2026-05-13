import { Issue, Session, Paged } from '../models/models';

export interface IssueRepository {
  listIssues(cursor?: string, limit?: number): Promise<Paged<Issue>>;
  getIssue(number: number): Promise<Issue | undefined>;
  listSessions(issueNumber: number, cursor?: string, limit?: number): Promise<Paged<Session> | undefined>;
  getSessionContent(issueNumber: number, sessionId: string): Promise<string | undefined>;
  saveIssue(issue: Issue): Promise<void>;
}
