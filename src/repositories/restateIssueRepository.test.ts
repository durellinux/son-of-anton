import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RestateIssueRepository } from './restateIssueRepository';
import { IssueStatus, PlanningSessionStatus, Issue, PlanningSession } from '../api';
import { rm, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

function createMockRestateClient() {
  const issues = new Map<string, Issue>();
  const plans = new Map<string, PlanningSession>();
  let issueNumbers: number[] = [];

  return {
    objectClient: (objectDef: any, key: string) => {
      const objectName = objectDef.name;
      if (objectName === 'IssueIndexObject') {
        return {
          addIssueNumber: async (num: number) => {
            if (!issueNumbers.includes(num)) {
              issueNumbers.push(num);
            }
          },
          removeIssueNumber: async (num: number) => {
            issueNumbers = issueNumbers.filter((n) => n !== num);
          },
          listIssues: async (req?: { cursor?: string; limit?: number }) => {
            const sorted = [...issueNumbers].sort((a, b) => b - a);
            const cursor = req?.cursor;
            const limit = req?.limit ?? 100;
            const startIndex = cursor ? sorted.indexOf(parseInt(cursor, 10)) : 0;
            if (startIndex === -1 && cursor) return [];
            return sorted.slice(startIndex, startIndex + limit);
          },
        };
      } else if (objectName === 'IssueObject') {
        return {
          getIssue: async () => {
            return issues.get(key);
          },
          saveIssue: async (issue: Issue) => {
            issues.set(key, issue);
            if (!issueNumbers.includes(issue.number)) {
              issueNumbers.push(issue.number);
            }
          },
          deleteIssue: async () => {
            const issue = issues.get(key);
            issues.delete(key);
            const num = issue?.number ?? parseInt(key, 10);
            if (!isNaN(num)) {
              issueNumbers = issueNumbers.filter((n) => n !== num);
            }
          },
          getPlanningSession: async () => {
            return plans.get(key);
          },
          savePlanningSession: async (session: PlanningSession) => {
            plans.set(key, session);
          },
          deletePlanningSession: async () => {
            plans.delete(key);
          },
        };
      }
      throw new Error(`Unknown object: ${objectName}`);
    },
  } as any;
}

describe('RestateIssueRepository', () => {
  const testDir = path.join('.anton', 'test-restate-repo');
  let repo: RestateIssueRepository;
  let mockClient: any;

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
    mockClient = createMockRestateClient();
    repo = new RestateIssueRepository(mockClient, testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should save and get issue correctly via Restate client', async () => {
    const issue: Issue = {
      number: 140,
      title: 'Migrate issue storage to Restate',
      url: 'https://github.com/durellinux/son-of-anton/issues/140',
      status: IssueStatus.YOLO,
    };
    await repo.saveIssue(issue);

    const fetched = await repo.getIssue(140);
    expect(fetched).toBeDefined();
    expect(fetched?.number).toBe(140);
    expect(fetched?.title).toBe('Migrate issue storage to Restate');
  });

  it('should list issues correctly from IssueIndexObject', async () => {
    const issue1: Issue = {
      number: 10,
      title: 'Issue 10',
      url: 'http://test.com/10',
      status: IssueStatus.YOLO,
    };
    const issue2: Issue = {
      number: 20,
      title: 'Issue 20',
      url: 'http://test.com/20',
      status: IssueStatus.YOLO,
    };

    await repo.saveIssue(issue1);
    await repo.saveIssue(issue2);

    const list = await repo.listIssues();
    expect(list.length).toBe(2);
    expect(list[0].number).toBe(20);
    expect(list[1].number).toBe(10);
  });

  it('should handle planning sessions via Restate client', async () => {
    const planningSession: PlanningSession = {
      number: 140,
      status: PlanningSessionStatus.WAITING_APPROVAL,
      history: [
        {
          plan: 'Restate migration plan',
          timestamp: new Date().toISOString(),
        },
      ],
    };
    await repo.savePlanningSession(planningSession);

    const fetched = await repo.getPlanningSession(140);
    expect(fetched).toBeDefined();
    expect(fetched?.number).toBe(140);
    expect(fetched?.status).toBe(PlanningSessionStatus.WAITING_APPROVAL);
    expect(fetched?.history.length).toBe(1);
    expect(fetched?.history[0].plan).toBe('Restate migration plan');
  });

  it('should list and retrieve session logs from filesystem', async () => {
    const sessionDir = path.join(testDir, '140', 'sessions');
    await mkdir(sessionDir, { recursive: true });
    const logContent = 'Session execution log';
    await writeFile(path.join(sessionDir, 'session_abc.txt'), logContent);

    const sessions = await repo.listSessions(140);
    expect(sessions).toBeDefined();
    expect(sessions?.length).toBe(1);
    expect(sessions?.[0].id).toBe('session_abc');

    const content = await repo.getSessionContent(140, 'session_abc');
    expect(content).toBe(logContent);
  });

  describe('deletion methods', () => {
    beforeEach(async () => {
      const issue: Issue = {
        number: 140,
        title: 'Issue 140',
        url: 'http://test.com/140',
        status: IssueStatus.YOLO,
      };
      await repo.saveIssue(issue);

      const sessionDir = path.join(testDir, '140', 'sessions');
      await mkdir(sessionDir, { recursive: true });
      await writeFile(path.join(sessionDir, 'session1.txt'), 'Log content');

      const planningSession: PlanningSession = {
        number: 140,
        status: PlanningSessionStatus.WAITING_APPROVAL,
        history: [{ plan: 'Plan', timestamp: new Date().toISOString() }],
      };
      await repo.savePlanningSession(planningSession);
    });

    it('should delete issue correctly', async () => {
      await repo.deleteIssue(140);
      const deletedIssue = await repo.getIssue(140);
      expect(deletedIssue).toBeUndefined();

      const list = await repo.listIssues();
      expect(list.length).toBe(0);
    });

    it('should delete sessions and planning session correctly', async () => {
      await repo.deleteSessions(140);
      const deletedSessions = await repo.listSessions(140);
      expect(deletedSessions).toBeUndefined();

      const deletedPlanning = await repo.getPlanningSession(140);
      expect(deletedPlanning).toBeUndefined();
    });

    it('should delete workspace correctly', async () => {
      const workspaceDir = path.join(testDir, '140', 'workspaces');
      await mkdir(workspaceDir, { recursive: true });
      await writeFile(path.join(workspaceDir, 'code.ts'), 'content');

      await repo.deleteWorkspace(140);
      await expect(stat(workspaceDir)).rejects.toThrow();
    });
  });
});
