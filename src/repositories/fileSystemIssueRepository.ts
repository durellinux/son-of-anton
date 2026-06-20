import { readdir, readFile, stat, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { Issue, Session, PlanningSession } from '../api';
import { IssueRepository } from './repositories';

export class FileSystemIssueRepository implements IssueRepository {
  private baseDir: string;

  constructor(baseDir: string = '.anton') {
    this.baseDir = baseDir;
  }

  private async ensureIssueDir(number: number) {
    const issueDir = path.join(this.baseDir, String(number));
    await mkdir(issueDir, { recursive: true });
    return issueDir;
  }

  async listIssues(cursor?: string, limit: number = 100): Promise<Issue[]> {
    let entries: { name: string; isDirectory: boolean }[];
    try {
      const dirents = await readdir(this.baseDir, { withFileTypes: true });
      entries = dirents.map((d) => ({ name: d.name, isDirectory: d.isDirectory() }));
    } catch (e) {
      if ((e as any).code === 'ENOENT') return [];
      throw new Error(
        `Failed to list issues directory: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }

    const allIssueNumbers = entries
      .filter((e) => e.isDirectory)
      .map((e) => parseInt(e.name, 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => b - a);

    const startIndex = cursor ? allIssueNumbers.indexOf(parseInt(cursor, 10)) : 0;
    if (startIndex === -1 && cursor) return [];

    const paginatedNumbers = allIssueNumbers.slice(startIndex, startIndex + limit);

    const items = await Promise.all(paginatedNumbers.map((n) => this.getIssue(n)));
    return items.filter((i): i is Issue => i !== undefined);
  }

  async getIssue(number: number): Promise<Issue | undefined> {
    const filePath = path.join(this.baseDir, String(number), 'issue.json');
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
    const issueDir = await this.ensureIssueDir(issue.number);
    const filePath = path.join(issueDir, 'issue.json');
    await writeFile(filePath, JSON.stringify(issue, null, 2));
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

  async getPlanningSession(issueNumber: number): Promise<PlanningSession | undefined> {
    const issueDir = await this.ensureIssueDir(issueNumber);
    const filePath = path.join(issueDir, 'plan.json');
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
    const issueDir = await this.ensureIssueDir(session.number);
    const filePath = path.join(issueDir, 'plan.json');
    await writeFile(filePath, JSON.stringify(session, null, 2));
  }

  async deletePlanningSession(issueNumber: number): Promise<void> {
    const filePath = path.join(this.baseDir, String(issueNumber), 'plan.json');
    try {
      await rm(filePath, { force: true });
    } catch (e) {
      throw new Error(
        `Failed to delete planning session for issue ${issueNumber}: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }
  }

  async deleteIssue(number: number): Promise<void> {
    const filePath = path.join(this.baseDir, String(number), 'issue.json');
    try {
      await rm(filePath, { force: true });
    } catch (e) {
      throw new Error(
        `Failed to delete issue ${number}: ${e instanceof Error ? e.message : String(e)}`,
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
