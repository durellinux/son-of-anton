import Fastify from 'fastify';
import { execa } from 'execa';
import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { determineIssueState, determinePRState, IssueState, Issue as GH_Issue, PullRequest, getUnaddressedPRComments, PRComment, PullRequestBase } from './issue-state';
import { FileSystemIssueRepository } from './src/repositories/FileSystemIssueRepository';
import { registerRoutes } from './src/resources/routes';
import { IssueStatus, Issue } from './src/models/issue';
import { IssueService } from './src/services/IssueService';

const repository = new FileSystemIssueRepository();
const issueService = new IssueService(repository);

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  }
});

const POLL_INTERVAL = 1 * 60 * 1000; // 1 minute

function mapStateToStatus(state: IssueState): IssueStatus {
    switch (state) {
        case IssueState.YOLO: return IssueStatus.YOLO;
        case IssueState.NEEDS_PLANNING: return IssueStatus.Planning;
        case IssueState.NEEDS_IMPLEMENTATION: return IssueStatus.Implementing;
        case IssueState.WAITING: return IssueStatus.WaitingPlanReview;
        default: return IssueStatus.Planning;
    }
}

async function executeGemini(id: number, prompt: string) {
  // Session Logging
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sessionDir = path.join('.anton', 'sessions', String(id));
  await mkdir(sessionDir, { recursive: true });
  
  const sessionFilePath = path.join(sessionDir, `${timestamp}.txt`);
  const logStream = createWriteStream(sessionFilePath);

  const subprocess = execa('gemini', [
    '-p', prompt,
    '--sandbox', 'true',
    '--approval-mode', 'yolo'
  ]);

  // Hook into the stream
  subprocess.stdout?.on('data', (chunk) => {
      const data = chunk.toString();
      logStream.write(data);
      process.stdout.write(data);
  });

  // Hook into the stream
  subprocess.stderr?.on('data', (chunk) => {
      const data = chunk.toString();
      logStream.write(data);
      process.stderr.write(data);
  });

  try {
    await subprocess;
    fastify.log.info(`Task #${id} finished successfully`);
  } catch (error) {
    fastify.log.error(`Task #${id} failed: %s`, error);
  } finally {
    logStream.end();
  }
}

async function runAnton() {
  fastify.log.info('Starting Anton iteration...');
  try {
    // 1. Fetch issues and PRs in Daemon
    const { stdout: issuesJson } = await execa('gh', ['search', 'issues', '--label', 'son-of-anton', '--state', 'open', '--json', 'number,title,repository,url', '--owner', '@me']);
    const basicIssues = JSON.parse(issuesJson) as { number: number, title: string, url: string,, repository: { nameWithOwner: string } }[];

    const { stdout: prsJson } = await execa('gh', ['search', 'prs', '--label', 'son-of-anton', '--state', 'open', '--json', 'number,url']);
    const basicPRs = JSON.parse(prsJson) as PullRequestBase[];

    if (basicIssues.length === 0 && basicPRs.length === 0) {
      fastify.log.info('No issues or PRs found to process.');
      return;
    }

    fastify.log.info(`Found ${basicIssues.length} issues and ${basicPRs.length} PRs to process.`);

    // 2. Process Issues
    for (const basicIssue of basicIssues) {
      const issueNumber = basicIssue.number;
      const issueRepo = basicIssue.repository.nameWithOwner;
      fastify.log.info(`Processing issue #${issueNumber}...`);

      // Fetch full issue details including comments and reactions
      const { stdout: issueDetailsJson } = await execa('gh', ['issue', 'view', String(issueNumber), '-R', issueRepo, '--json', 'body,comments']);
      const issueDetails = JSON.parse(issueDetailsJson) as GH_Issue;

      const state = determineIssueState(issueDetails);
      fastify.log.info(`Issue #${issueNumber} state: ${state}`);

      // Save to repository
      const issue: Issue = {
          number: issueNumber,
          title: basicIssue.title,
          url: basicIssue.url,
          status: mapStateToStatus(state),
      };
      await repository.saveIssue(issue);

      let prompt = '';
      switch (state) {
        case IssueState.YOLO:
          prompt = `Research, plan and implement the fix for issue ${issueNumber}. Follow the plan and implement skills workflow.`;
          break;
        case IssueState.NEEDS_PLANNING:
          prompt = `follow the plan skill flow for issue ${issueNumber}`;
          break;
        case IssueState.NEEDS_IMPLEMENTATION:
          prompt = `follow the implement skill flow for issue ${issueNumber}`;
          break;
        case IssueState.WAITING:
          fastify.log.info(`Issue #${issueNumber} is waiting for approval. Skipping.`);
          continue;
      }

      await executeGemini(issueNumber, prompt);
    }

    // 3. Process PRs
    for (const pr of basicPRs) {
      fastify.log.info(`Processing PR #${pr.number}...`);
      const urlParts = pr.url.split('/');
      const owner = urlParts[3];
      const repo = urlParts[4];

      const { stdout: prDetailsJson } = await execa('gh', ['pr', 'list', '-R', `${owner}/${repo}`, '--json', 'number,headRefName,url,reviewDecision', '--jq', `.[] | select(.number==${pr.number})`]);
      const prDetails = JSON.parse(prDetailsJson) as PullRequest;

      const state = determinePRState(prDetails);
      fastify.log.info(`PR #${prDetails.number} state: ${state}`);

      if (state === IssueState.NEEDS_IMPLEMENTATION) {
        // Extract owner and repo from URL: https://github.com/owner/repo/pull/number
        const fullRepo = `${owner}/${repo}`;

        // Fetch PR comments to be deterministic
        const { stdout: commentsJson } = await execa('gh', ['api', `repos/${fullRepo}/pulls/${prDetails.number}/comments`]);
        const comments = JSON.parse(commentsJson) as PRComment[];
        const unaddressedCommentIds = getUnaddressedPRComments(comments);

        if (unaddressedCommentIds.length > 0) {
            // Extract issue number from branch name (e.g., anton/30)
            const issueMatch = prDetails.headRefName.match(/anton\/(\d+)/);
            const issueNumber = issueMatch ? issueMatch[1] : `pr-${prDetails.number}`;
            const issueParam = `for issue ${issueNumber} `;
            const prompt = `follow the handle-review-comments skill flow ${issueParam}for PR ${prDetails.number} on branch ${prDetails.headRefName} in repo ${fullRepo} with comment IDs ${unaddressedCommentIds.join(', ')}`;
            await executeGemini(prDetails.number, prompt);
        } else {
            fastify.log.info(`PR #${prDetails.number} has no unaddressed comments. Skipping.`);
        }
      } else {
        fastify.log.info(`PR #${prDetails.number} is waiting. Skipping.`);
      }
    }

    fastify.log.info('Anton iteration finished');
  } catch (error) {
    fastify.log.error('Anton failed to execute: %s', error);
  }
}

// Start the polling loop
async function startPolling() {
  while (true) {
    await runAnton();
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

const start = async () => {
  try {
    fastify.get('/health', async () => {
      return { status: 'ok' };
    });

    fastify.get('/ready', async () => {
      return { status: 'ok' };
    });

    fastify.register(registerRoutes, { issueService });

    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    fastify.log.info('Son of Anton Daemon is running on port 3000');
    await startPolling();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
