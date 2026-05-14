import { Issue, Session } from '../api';
import { IssueRepository } from '../repositories/repositories';

export type Paged<T> = {
  items: T[];
  nextCursor?: string;
};

export class IssueService {
  constructor(private repository: IssueRepository) {}

  async getIssues(cursor?: string, limit: number = 10): Promise<Paged<Issue>> {
    const items = await this.repository.listIssues(cursor, limit + 1);
    const hasNextPage = items.length > limit;
    const pagedItems = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? items[limit].number.toString() : undefined;
    return {
      items: pagedItems,
      nextCursor
    };
  }

  async getIssue(number: number): Promise<Issue | undefined> {
    return this.repository.getIssue(number);
  }

  async getSessions(issueNumber: number, cursor?: string, limit: number = 10): Promise<Paged<Session> | undefined> {
    const items = await this.repository.listSessions(issueNumber, cursor, limit + 1);
    if (!items) return undefined;
    const hasNextPage = items.length > limit;
    const pagedItems = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? items[limit].id : undefined;
    return {
      items: pagedItems,
      nextCursor
    };
  }

  async getSessionContent(issueNumber: number, sessionId: string): Promise<string | undefined> {
    return this.repository.getSessionContent(issueNumber, sessionId);
  }

  async updateIssue(issue: Issue): Promise<void> {
    // Add business logic here if needed before saving
    return this.repository.saveIssue(issue);
  }
}
