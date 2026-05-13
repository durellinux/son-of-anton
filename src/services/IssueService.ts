import { Issue } from '../models/issue';
import { Session } from '../models/session';
import { Paged } from '../models/pagination';
import { IssueRepository } from '../repositories/repositories';

export class IssueService {
  constructor(private repository: IssueRepository) {}

  async getIssues(cursor?: string, limit?: number): Promise<Paged<Issue>> {
    return this.repository.listIssues(cursor, limit);
  }

  async getIssue(number: number): Promise<Issue | undefined> {
    return this.repository.getIssue(number);
  }

  async getSessions(issueNumber: number, cursor?: string, limit?: number): Promise<Paged<Session> | undefined> {
    return this.repository.listSessions(issueNumber, cursor, limit);
  }

  async getSessionContent(issueNumber: number, sessionId: string): Promise<string | undefined> {
    return this.repository.getSessionContent(issueNumber, sessionId);
  }

  async updateIssue(issue: Issue): Promise<void> {
    // Add business logic here if needed before saving
    return this.repository.saveIssue(issue);
  }
}
