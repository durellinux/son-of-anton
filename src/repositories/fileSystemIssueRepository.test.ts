import { FileSystemIssueRepository } from './fileSystemIssueRepository';
import { IssueStatus, PlanningSessionStatus } from '../api';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function test() {
  const testDir = path.join('.anton', 'test-state');
  await rm(testDir, { recursive: true, force: true });
  await mkdir(testDir, { recursive: true });

  const repo = new FileSystemIssueRepository(testDir);

  console.log('Testing saveIssue and getIssue...');
  const issue = {
    number: 37,
    title: 'Test Issue',
    url: 'http://test.com',
    status: IssueStatus.YOLO
  };
  await repo.saveIssue(issue);

  const fetched = await repo.getIssue(37);
  if (!fetched || fetched.number !== 37 || fetched.title !== 'Test Issue') {
    throw new Error('getIssue failed');
  }
  console.log('saveIssue and getIssue passed.');

  console.log('Testing listIssues...');
  const list = await repo.listIssues();
  if (list.length !== 1 || list[0].number !== 37) {
    throw new Error('listIssues failed');
  }
  console.log('listIssues passed.');

  console.log('Testing sessions...');
  const sessionDir = path.join(testDir, 'sessions', '37');
  await mkdir(sessionDir, { recursive: true });
  const sessionContent = 'Log content';
  await writeFile(path.join(sessionDir, 'session1.txt'), sessionContent);

  const sessions = await repo.listSessions(37);
  if (!sessions || sessions.length !== 1 || sessions[0].id !== 'session1') {
    throw new Error('listSessions failed');
  }

  const content = await repo.getSessionContent(37, 'session1');
  if (content !== sessionContent) {
    throw new Error('getSessionContent failed');
  }
  console.log('sessions passed.');

  console.log('Testing planning sessions...');
  const planningSession = {
    number: 37,
    status: PlanningSessionStatus.WAITING_APPROVAL,
    history: [
      {
        plan: 'My plan',
        timestamp: new Date().toISOString()
      }
    ]
  };
  await repo.savePlanningSession(planningSession);

  const fetchedPlanning = await repo.getPlanningSession(37);
  if (!fetchedPlanning || fetchedPlanning.number !== 37 || fetchedPlanning.status !== PlanningSessionStatus.WAITING_APPROVAL) {
    throw new Error('getPlanningSession failed');
  }
  if (fetchedPlanning.history.length !== 1 || fetchedPlanning.history[0].plan !== 'My plan') {
    throw new Error('getPlanningSession history failed');
  }
  console.log('planning sessions passed.');

  await rm(testDir, { recursive: true, force: true });
  console.log('All repository tests passed!');
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
