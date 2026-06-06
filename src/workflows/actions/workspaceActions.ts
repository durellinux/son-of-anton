import { execa } from 'execa';
import path from 'node:path';
import { mkdir, stat } from 'node:fs/promises';

export class RebaseConflictError extends Error {
  constructor(public conflictDetails: string) {
    super(`Rebase conflict detected: ${conflictDetails}`);
    this.name = 'RebaseConflictError';
  }
}

export async function setupWorkspace(
  issueNumber: number,
  issueRepo: string,
  branch: string | undefined,
) {
  const [owner, repoName] = issueRepo.split('/');
  const workspacePath = path.join('.anton', String(issueNumber), 'workspaces', owner);

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

  // Fetch Latest State
  console.log(`Fetching latest state for ${issueRepo}...`);
  await execa('git', ['fetch', 'origin'], { cwd: repoPath });

  // Determine Default Branch
  const { stdout: repoViewJson } = await execa(
    'gh',
    ['repo', 'view', issueRepo, '--json', 'defaultBranchRef'],
    { cwd: repoPath },
  );
  const defaultBranch = JSON.parse(repoViewJson).defaultBranchRef.name;
  console.log(`Default branch identified as: ${defaultBranch}`);

  if (branch) {
    console.log(`Setting up branch: ${branch}`);
    // Checkout the branch. If it doesn't exist locally, try to track it from origin
    try {
      await execa('git', ['checkout', branch], { cwd: repoPath });
    } catch {
      await execa('git', ['checkout', '-b', branch, `origin/${branch}`], { cwd: repoPath });
    }

    // Reset the local branch to origin/<branch> to ensure it matches the remote state.
    await execa('git', ['reset', '--hard', `origin/${branch}`], { cwd: repoPath });

    // Rebase the branch onto origin/<defaultBranch>.
    console.log(`Rebasing ${branch} onto origin/${defaultBranch}...`);
    try {
      await execa('git', ['rebase', `origin/${defaultBranch}`], { cwd: repoPath });
    } catch (error: any) {
      const stderr = error.stderr || error.message;
      console.error(`Rebase conflict detected: ${stderr}`);
      // If rebase fails, throw RebaseConflictError
      throw new RebaseConflictError(stderr);
    }
  } else {
    console.log(`No branch specified, checking out default branch: ${defaultBranch}`);
    await execa('git', ['checkout', defaultBranch], { cwd: repoPath });
    await execa('git', ['reset', '--hard', `origin/${defaultBranch}`], { cwd: repoPath });
  }
}

export async function findPullRequest(
  issueNumber: number,
  issueRepo: string,
): Promise<{ prNumber: number; prUrl: string }> {
  const [owner, repoName] = issueRepo.split('/');
  const repoPath = path.join('.anton', String(issueNumber), 'workspaces', owner, repoName);

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
