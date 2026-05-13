import { FileSystemIssueRepository } from './FileSystemIssueRepository';
import { IssueStatus } from '../models/models';
import { rm, mkdir } from 'node:fs/promises';
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
  if (list.items.length !== 1 || list.items[0].number !== 37) {
    throw new Error('listIssues failed');
  }
  console.log('listIssues passed.');

  console.log('Testing sessions...');
  const sessionDir = path.join(testDir, 'sessions', '37');
  await mkdir(sessionDir, { recursive: true });
  const sessionContent = 'Log content';
  const fs = require('node:fs/promises');
  await fs.writeFile(path.join(sessionDir, 'session1.txt'), sessionContent);

  const sessions = await repo.listSessions(37);
  if (!sessions || sessions.items.length !== 1 || sessions.items[0].id !== 'session1') {
    throw new Error('listSessions failed');
  }

  const content = await repo.getSessionContent(37, 'session1');
  if (content !== sessionContent) {
    throw new Error('getSessionContent failed');
  }
  console.log('sessions passed.');

  await rm(testDir, { recursive: true, force: true });
  console.log('All repository tests passed!');
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
