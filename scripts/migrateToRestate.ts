import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import * as restateClients from '@restatedev/restate-sdk-clients';
import { issueObject } from '../src/restate/issueObject';

async function migrate() {
  const baseDir = process.argv[2] || '.anton';
  const RESTATE_URL = process.env.RESTATE_URL || 'http://localhost:8080';
  const restateClient = restateClients.connect({ url: RESTATE_URL });

  console.log(
    `Starting migration from filesystem directory '${baseDir}' to Restate at '${RESTATE_URL}'...`,
  );

  let dirents;
  try {
    dirents = await readdir(baseDir, { withFileTypes: true });
  } catch (e) {
    console.error(`Directory ${baseDir} not found or unreadable:`, e);
    process.exit(1);
  }

  const issueDirs = dirents
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => !isNaN(parseInt(name, 10)));

  for (const dirName of issueDirs) {
    const issueNumber = parseInt(dirName, 10);
    const issuePath = path.join(baseDir, dirName, 'issue.json');
    const planPath = path.join(baseDir, dirName, 'plan.json');

    const issueClient: any = restateClient.objectClient(issueObject as any, String(issueNumber));

    try {
      const issueContent = await readFile(issuePath, 'utf-8');
      const issue = JSON.parse(issueContent);
      await issueClient.saveIssue(issue);
      console.log(`Migrated issue #${issueNumber}`);
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        console.error(`Failed to migrate issue #${issueNumber}:`, e);
      }
    }

    try {
      const planContent = await readFile(planPath, 'utf-8');
      const plan = JSON.parse(planContent);
      await issueClient.savePlanningSession(plan);
      console.log(`Migrated planning session for issue #${issueNumber}`);
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        console.error(`Failed to migrate plan for issue #${issueNumber}:`, e);
      }
    }
  }

  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
