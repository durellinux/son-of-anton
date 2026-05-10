import Fastify from 'fastify';
import { execa } from 'execa';
import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { determineIssueState, determinePRState, IssueState, Issue, PullRequest, getUnaddressedPRComments, PRComment } from './issue-state';

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

async function executeGemini(id: number, prompt: string) {
  // Session Logging
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sessionDir = path.join('.anton', 'sessions', String(id));
  await mkdir(sessionDir, { recursive: true });
  
  const sessionFilePath = path.join(sessionDir, `${timestamp}.txt`);
  const logStream = createWriteStream(sessionFilePath);

  const subprocess = execa('gemini', [
    '-p', prompt,
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
    const { stdout: issuesJson } = await execa('gh', ['issue', 'list', '--label', 'son-of-anton', '--state', 'open', '--json', 'number']);
    const basicIssues = JSON.parse(issuesJson) as { number: number }[];

    const { stdout: prsJson } = await execa('gh', ['pr', 'list', '--label', 'son-of-anton', '--state', 'open', '--json', 'number,reviewDecision,headRefName,url']);
    const basicPRs = JSON.parse(prsJson) as PullRequest[];

    if (basicIssues.length === 0 && basicPRs.length === 0) {
      fastify.log.info('No issues or PRs found to process.');
      return;
    }

    fastify.log.info(`Found ${basicIssues.length} issues and ${basicPRs.length} PRs to process.`);

    // 2. Process Issues
    // ... (rest of issues processing remains same)
    for (const basicIssue of basicIssues) {
      const issueNumber = basicIssue.number;
      fastify.log.info(`Processing issue #${issueNumber}...`);

      // Fetch full issue details including comments and reactions
      const { stdout: issueDetailsJson } = await execa('gh', ['issue', 'view', String(issueNumber), '--json', 'body,comments']);
      const issueDetails = JSON.parse(issueDetailsJson) as Issue;

      const state = determineIssueState(issueDetails);
      fastify.log.info(`Issue #${issueNumber} state: ${state}`);

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

      const state = determinePRState(pr);
      fastify.log.info(`PR #${pr.number} state: ${state}`);

      if (state === IssueState.NEEDS_IMPLEMENTATION) {
        // Extract owner and repo from URL: https://github.com/owner/repo/pull/number
        const urlParts = pr.url.split('/');
        const owner = urlParts[3];
        const repo = urlParts[4];
        const fullRepo = `${owner}/${repo}`;

        // Fetch PR comments to be deterministic
        const { stdout: commentsJson } = await execa('gh', ['api', `repos/${fullRepo}/pulls/${pr.number}/comments`]);
        const comments = JSON.parse(commentsJson) as PRComment[];
        const unaddressedCommentIds = getUnaddressedPRComments(comments);

        if (unaddressedCommentIds.length > 0) {
            const prompt = `follow the handle-review-comments skill flow for PR ${pr.number} on branch ${pr.headRefName} in repo ${fullRepo} with comment IDs ${unaddressedCommentIds.join(', ')}`;
            await executeGemini(pr.number, prompt);
        } else {
            fastify.log.info(`PR #${pr.number} has no unaddressed comments. Skipping.`);
        }
      } else {
        fastify.log.info(`PR #${pr.number} is waiting. Skipping.`);
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

    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    fastify.log.info('Son of Anton Daemon is running on port 3000');
    await startPolling();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
