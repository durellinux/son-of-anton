import { Issue } from '../models/issue';
import { Session } from '../models/session';
import { Paged } from '../models/pagination';

export interface IssueRepository {
  listIssues(cursor?: string, limit?: number): Promise<Issue[]>;
  getIssue(number: number): Promise<Issue | undefined>;
  listSessions(issueNumber: number, cursor?: string, limit?: number): Promise<Session[] | undefined>;
  getSessionContent(issueNumber: number, sessionId: string): Promise<string | undefined>;
  saveIssue(issue: Issue): Promise<void>;
}
