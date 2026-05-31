import { readdir, readFile, stat, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { Issue, Session, PlanningSession } from '../api';
import { IssueRepository } from './repositories';

export class FileSystemIssueRepository implements IssueRepository {
  private baseDir: string;

  constructor(baseDir: string = '.anton') {
    this.baseDir = baseDir;
  }

  private async ensureIssuesDir() {
    const issuesDir = path.join(this.baseDir, 'issues');
    await mkdir(issuesDir, { recursive: true });
    return issuesDir;
  }

  async listIssues(cursor?: string, limit: number = 10): Promise<Issue[]> {
    const issuesDir = await this.ensureIssuesDir();
    let issueFiles: string[];
    try {
      issueFiles = await readdir(issuesDir);
    } catch (e) {
      throw new Error(
        `Failed to list issues directory: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }

    const allIssueNumbers = issueFiles
      .filter((f) => f.endsWith('.json'))
      .map((f) => parseInt(f.replace('.json', ''), 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => b - a);

    const startIndex = cursor ? allIssueNumbers.indexOf(parseInt(cursor, 10)) : 0;
    if (startIndex === -1 && cursor) return [];

    const paginatedNumbers = allIssueNumbers.slice(startIndex, startIndex + limit);

    const items = await Promise.all(paginatedNumbers.map((n) => this.getIssue(n)));
    return items.filter((i): i is Issue => i !== undefined);
  }

  async getIssue(number: number): Promise<Issue | undefined> {
    const filePath = path.join(this.baseDir, 'issues', `${number}.json`);
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content) as Issue;
    } catch (e) {
      if ((e as any).code === 'ENOENT') {
        return undefined;
      }
      throw new Error(
        `Failed to read issue ${number}: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }
  }

  async saveIssue(issue: Issue): Promise<void> {
    const issuesDir = await this.ensureIssuesDir();
    const filePath = path.join(issuesDir, `${issue.number}.json`);
    await writeFile(filePath, JSON.stringify(issue, null, 2));
  }

  async listSessions(
    issueNumber: number,
    cursor?: string,
    limit: number = 10,
  ): Promise<Session[] | undefined> {
    const sessionDir = path.join(this.baseDir, 'sessions', String(issueNumber));
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
            type: 'implementing', // Inferring from issue state or just default
            timestamp: s.mtime.toISOString(),
            status: 'success', // Default
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
      'sessions',
      String(issueNumber),
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

  async getPlanningSession(issueNumber: number): Promise<PlanningSession | undefined> {
    const filePath = path.join(this.baseDir, 'planning', `${issueNumber}.json`);
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content) as PlanningSession;
    } catch (e) {
      if ((e as any).code === 'ENOENT') {
        return undefined;
      }
      throw new Error(
        `Failed to read planning session for issue ${issueNumber}: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }
  }

  async savePlanningSession(session: PlanningSession): Promise<void> {
    const planningDir = path.join(this.baseDir, 'planning');
    await mkdir(planningDir, { recursive: true });
    const filePath = path.join(planningDir, `${session.number}.json`);
    await writeFile(filePath, JSON.stringify(session, null, 2));
  }

  async deletePlanningSession(issueNumber: number): Promise<void> {
    const filePath = path.join(this.baseDir, 'planning', `${issueNumber}.json`);
    try {
      await rm(filePath, { force: true });
    } catch (e) {
      throw new Error(
        `Failed to delete planning session for issue ${issueNumber}: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }
  }
}
