import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemIssueRepository } from './fileSystemIssueRepository';
import { IssueStatus, PlanningSessionStatus } from '../api';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

describe('FileSystemIssueRepository', () => {
  const testDir = path.join('.anton', 'test-state');

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('saves and gets issues correctly', async () => {
    const repo = new FileSystemIssueRepository(testDir);
    const issue = {
      number: 37,
      title: 'Test Issue',
      url: 'http://test.com',
      status: IssueStatus.YOLO,
    };
    await repo.saveIssue(issue);

    const fetched = await repo.getIssue(37);
    expect(fetched).toBeDefined();
    expect(fetched?.number).toBe(37);
    expect(fetched?.title).toBe('Test Issue');
  });

  it('lists issues correctly', async () => {
    const repo = new FileSystemIssueRepository(testDir);
    const issue = {
      number: 37,
      title: 'Test Issue',
      url: 'http://test.com',
      status: IssueStatus.YOLO,
    };
    await repo.saveIssue(issue);

    const list = await repo.listIssues();
    expect(list.length).toBe(1);
    expect(list[0].number).toBe(37);
  });

  it('handles sessions correctly', async () => {
    const repo = new FileSystemIssueRepository(testDir);
    const sessionDir = path.join(testDir, '37', 'sessions');
    await mkdir(sessionDir, { recursive: true });
    const sessionContent = 'Log content';
    await writeFile(path.join(sessionDir, 'session1.txt'), sessionContent);

    const sessions = await repo.listSessions(37);
    expect(sessions).toBeDefined();
    expect(sessions?.length).toBe(1);
    expect(sessions?.[0].id).toBe('session1');

    const content = await repo.getSessionContent(37, 'session1');
    expect(content).toBe(sessionContent);
  });

  it('handles planning sessions correctly', async () => {
    const repo = new FileSystemIssueRepository(testDir);
    const planningSession = {
      number: 37,
      status: PlanningSessionStatus.WAITING_APPROVAL,
      history: [
        {
          plan: 'My plan',
          timestamp: new Date().toISOString(),
        },
      ],
    };
    await repo.savePlanningSession(planningSession);

    const fetchedPlanning = await repo.getPlanningSession(37);
    expect(fetchedPlanning).toBeDefined();
    expect(fetchedPlanning?.number).toBe(37);
    expect(fetchedPlanning?.status).toBe(PlanningSessionStatus.WAITING_APPROVAL);
    expect(fetchedPlanning?.history.length).toBe(1);
    expect(fetchedPlanning?.history[0].plan).toBe('My plan');
  });

  it('handles deletion methods correctly', async () => {
    const repo = new FileSystemIssueRepository(testDir);

    // Setup issue
    const issue = {
      number: 37,
      title: 'Test Issue',
      url: 'http://test.com',
      status: IssueStatus.YOLO,
    };
    await repo.saveIssue(issue);

    // Setup sessions
    const sessionDir = path.join(testDir, '37', 'sessions');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(path.join(sessionDir, 'session1.txt'), 'content');

    // Setup planning session
    const planningSession = {
      number: 37,
      status: PlanningSessionStatus.WAITING_APPROVAL,
      history: [{ plan: 'My plan', timestamp: new Date().toISOString() }],
    };
    await repo.savePlanningSession(planningSession);

    // Test deleteIssue
    await repo.deleteIssue(37);
    const deletedIssue = await repo.getIssue(37);
    expect(deletedIssue).toBeUndefined();

    // Test deleteSessions
    await repo.deleteSessions(37);
    const deletedSessions = await repo.listSessions(37);
    expect(deletedSessions).toBeUndefined();
    const deletedPlanning = await repo.getPlanningSession(37);
    expect(deletedPlanning).toBeUndefined();

    // Test deleteWorkspace
    const workspaceDir = path.join(testDir, '37', 'workspaces');
    await mkdir(workspaceDir, { recursive: true });
    await writeFile(path.join(workspaceDir, 'code.ts'), 'content');

    await repo.deleteWorkspace(37);
    try {
      const fs = await import('node:fs/promises');
      await fs.stat(workspaceDir);
      throw new Error('deleteWorkspace failed: workspace directory still exists');
    } catch (e: any) {
      expect(e.code).toBe('ENOENT');
    }
  });
});
