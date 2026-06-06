import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function readAdrFile(
  issueNumber: number,
  repo: string,
  adrPath: string,
): Promise<string> {
  // We assume the workspace is already set up or we can read it directly if it's local.
  // But workflows should be robust.
  // For now, let's try to read it from the local workspace if it exists, otherwise use gh api.

  const workspacePath = path.join('.anton', 'workspaces', String(issueNumber), repo);
  const fullPath = path.join(workspacePath, adrPath);

  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch {
    // Fallback to gh api
    const { stdout } = await execa('gh', [
      'api',
      `repos/${repo}/contents/${adrPath}`,
      '--jq',
      '.content',
    ]);
    return Buffer.from(stdout, 'base64').toString('utf-8');
  }
}

export async function createGitHubIssue(
  repo: string,
  title: string,
  body: string,
  labels: string[] = [],
): Promise<number> {
  const args = ['issue', 'create', '-R', repo, '-t', title, '-b', body];

  for (const label of labels) {
    args.push('-l', label);
  }

  const { stdout } = await execa('gh', args);
  // stdout is like "https://github.com/owner/repo/issues/123"
  const match = stdout.match(/issues\/(\d+)/);
  if (!match) {
    throw new Error(`Failed to parse issue number from gh output: ${stdout}`);
  }
  return parseInt(match[1], 10);
}
