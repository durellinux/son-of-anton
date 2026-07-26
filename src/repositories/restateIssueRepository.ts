import { readdir, readFile, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import * as restateClients from '@restatedev/restate-sdk-clients';
import { Issue, Session, PlanningSession } from '../api';
import { IssueRepository } from './repositories';
import { issueObject } from '../restate/issueObject';
import { issueIndexObject } from '../restate/issueIndexObject';

export class RestateIssueRepository implements IssueRepository {
  private restateClient: restateClients.Ingress;
  private baseDir: string;

  constructor(restateClient: restateClients.Ingress, baseDir: string = '.anton') {
    this.restateClient = restateClient;
    this.baseDir = baseDir;
  }

  async listIssues(cursor?: string, limit: number = 100): Promise<Issue[]> {
    const indexClient = this.restateClient.objectClient(issueIndexObject, 'global');
    const numbers: number[] = await indexClient.listIssues({ cursor, limit });
    const items = await Promise.all(numbers.map((n) => this.getIssue(n)));
    return items.filter((i): i is Issue => i !== undefined);
  }

  async getIssue(number: number): Promise<Issue | undefined> {
    const issueClient = this.restateClient.objectClient(issueObject, String(number));
    return await issueClient.getIssue();
  }

  async saveIssue(issue: Issue): Promise<void> {
    const issueClient = this.restateClient.objectClient(
      issueObject,
      String(issue.number),
    );
    await issueClient.saveIssue(issue);
  }

  async deleteIssue(number: number): Promise<void> {
    const issueClient = this.restateClient.objectClient(issueObject, String(number));
    await issueClient.deleteIssue();
  }

  async getPlanningSession(issueNumber: number): Promise<PlanningSession | undefined> {
    const issueClient = this.restateClient.objectClient(
      issueObject,
      String(issueNumber),
    );
    return await issueClient.getPlanningSession();
  }

  async savePlanningSession(session: PlanningSession): Promise<void> {
    const issueClient = this.restateClient.objectClient(
      issueObject,
      String(session.number),
    );
    await issueClient.savePlanningSession(session);
  }

  async deletePlanningSession(issueNumber: number): Promise<void> {
    const issueClient = this.restateClient.objectClient(
      issueObject,
      String(issueNumber),
    );
    await issueClient.deletePlanningSession();
  }

  async listSessions(
    issueNumber: number,
    cursor?: string,
    limit: number = 10,
  ): Promise<Session[] | undefined> {
    const sessionDir = path.join(this.baseDir, String(issueNumber), 'sessions');
    try {
      const files = await readdir(sessionDir);
      const sessionFiles = files
        .filter((f) => f.endsWith('.txt'))
        .sort((a, b) => b.localeCompare(a)); // Newest first

      const startIndex = cursor ? sessionFiles.indexOf(cursor) : 0;
      if (startIndex === -1 && cursor) return [];

      const paginatedFiles = sessionFiles.slice(startIndex, startIndex + limit);

      const items: Session[] = await Promise.all(
        paginatedFiles.map(async (f) => {
          const filePath = path.join(sessionDir, f);
          const s = await stat(filePath);
          const id = f.replace('.txt', '');
          return {
            id,
            type: 'implementing',
            timestamp: s.mtime.toISOString(),
            status: 'success',
          };
        }),
      );

      return items;
    } catch (e) {
      if ((e as any).code === 'ENOENT') {
        return undefined;
      }
      throw new Error(
        `Failed to list sessions for issue ${issueNumber}: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }
  }

  async getSessionContent(issueNumber: number, sessionId: string): Promise<string | undefined> {
    const filePathFull = path.join(
      this.baseDir,
      String(issueNumber),
      'sessions',
      `${sessionId}.txt`,
    );
    try {
      return await readFile(filePathFull, 'utf-8');
    } catch (e) {
      if ((e as any).code === 'ENOENT') {
        return undefined;
      }
      throw new Error(
        `Failed to read session ${sessionId} for issue ${issueNumber}: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }
  }

  async deleteSessions(number: number): Promise<void> {
    const sessionDir = path.join(this.baseDir, String(number), 'sessions');
    try {
      await rm(sessionDir, { recursive: true, force: true });
      await this.deletePlanningSession(number);
    } catch (e) {
      throw new Error(
        `Failed to delete sessions for issue ${number}: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }
  }

  async deleteWorkspace(number: number): Promise<void> {
    const workspaceDir = path.join(this.baseDir, String(number), 'workspaces');
    try {
      await rm(workspaceDir, { recursive: true, force: true });
    } catch (e) {
      throw new Error(
        `Failed to delete workspace for issue ${number}: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }
  }
}
