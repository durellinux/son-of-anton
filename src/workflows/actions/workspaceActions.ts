import { execa } from 'execa';
import path from 'node:path';
import { mkdir, stat } from 'node:fs/promises';

export async function setupWorkspace(
  issueNumber: number,
  issueRepo: string,
  branch: string | undefined,
) {
  const [owner, repoName] = issueRepo.split('/');
  const workspacePath = path.join('.anton', 'workspaces', String(issueNumber), owner);

  // Create workspace folder
  await mkdir(workspacePath, { recursive: true });

  // Clone repo in workspace folder if it doesn't already exist
  const repoPath = path.join(workspacePath, repoName);
  try {
    await stat(repoPath);
  } catch {
    // If stat fails, the directory does not exist, so clone the repo
    await execa('gh', ['repo', 'clone', issueRepo], { cwd: workspacePath });
  }

  if (branch) {
    await execa('git', ['checkout', branch], { cwd: repoPath });
  }
}

export async function findPullRequest(
  issueNumber: number,
  issueRepo: string,
): Promise<{ prNumber: number; prUrl: string }> {
  const [owner, repoName] = issueRepo.split('/');
  const repoPath = path.join('.anton', 'workspaces', String(issueNumber), owner, repoName);

  // Compute branch name from branch in repo folder in workspace
  const { stdout: branchName } = await execa('git', ['branch', '--show-current'], {
    cwd: repoPath,
  });

  // Get PR id and url for branch
  const { stdout: prsJson } = await execa('gh', [
    'pr',
    'list',
    '--repo',
    issueRepo,
    '--state',
    'open',
    '--head',
    branchName.trim(),
    '--json',
    'number,url',
  ]);

  const prs = JSON.parse(prsJson);
  if (prs.length === 0) {
    throw new Error(`No open pull request found for branch ${branchName.trim()}`);
  }

  return { prNumber: prs[0].number, prUrl: prs[0].url };
}
