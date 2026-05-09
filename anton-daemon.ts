import Fastify from 'fastify';
import { execa } from 'execa';
import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';

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

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function runAnton() {
  fastify.log.info('Starting Anton iteration...');
  try {
    // 1. Fetch issues in Daemon
    const { stdout: issuesJson } = await execa('gh', ['issue', 'list', '--label', 'son-of-anton', '--state', 'open', '--json', 'number']);
    const issues = JSON.parse(issuesJson) as { number: number }[];

    // 2. Fetch Pull Requests with requested changes
    const { stdout: prsJson } = await execa('gh', ['pr', 'list', '--label', 'son-of-anton', '--state', 'open', '--json', 'number,reviewDecision']);
    const allPrs = JSON.parse(prsJson) as { number: number, reviewDecision: string }[];
    const prsToFix = allPrs.filter(pr => pr.reviewDecision === 'CHANGES_REQUESTED');

    if (issues.length === 0 && prsToFix.length === 0) {
      fastify.log.info('No issues or PRs found to process.');
      return;
    }

    fastify.log.info(`Found ${issues.length} issues and ${prsToFix.length} PRs to process.`);

    // 3. Process Issues
    for (const issue of issues) {
      const issueNumber = issue.number;
      fastify.log.info(`Processing issue #${issueNumber}...`);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sessionDir = path.join('.anton', 'sessions', 'issue-' + String(issueNumber), timestamp);
      await mkdir(sessionDir, { recursive: true });
      
      const sessionFilePath = path.join(sessionDir, 'session.txt');
      const logStream = createWriteStream(sessionFilePath);

      const subprocess = execa('gemini', [
        '-p', `follow the implement-fix skill flow for issue ${issueNumber}`,
        '--approval-mode', 'yolo'
      ]);

      subprocess.stdout?.on('data', (chunk) => {
          const data = chunk.toString();
          logStream.write(data);
          process.stdout.write(data);
      });

      subprocess.stderr?.on('data', (chunk) => {
          const data = chunk.toString();
          logStream.write(data);
          process.stderr.write(data);
      });

      try {
        await subprocess;
        fastify.log.info(`Issue #${issueNumber} finished successfully`);
      } catch (error) {
        fastify.log.error(`Issue #${issueNumber} failed: %s`, error);
      } finally {
        logStream.end();
      }
    }

    // 4. Process PRs
    for (const pr of prsToFix) {
      const prNumber = pr.number;
      fastify.log.info(`Processing PR #${prNumber}...`);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sessionDir = path.join('.anton', 'sessions', 'pr-' + String(prNumber), timestamp);
      await mkdir(sessionDir, { recursive: true });
      
      const sessionFilePath = path.join(sessionDir, 'session.txt');
      const logStream = createWriteStream(sessionFilePath);

      const subprocess = execa('gemini', [
        '-p', `follow the handle-review-comments skill flow for PR ${prNumber}`,
        '--approval-mode', 'yolo'
      ]);

      subprocess.stdout?.on('data', (chunk) => {
          const data = chunk.toString();
          logStream.write(data);
          process.stdout.write(data);
      });

      subprocess.stderr?.on('data', (chunk) => {
          const data = chunk.toString();
          logStream.write(data);
          process.stderr.write(data);
      });

      try {
        await subprocess;
        fastify.log.info(`PR #${prNumber} finished successfully`);
      } catch (error) {
        fastify.log.error(`PR #${prNumber} failed: %s`, error);
      } finally {
        logStream.end();
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
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    fastify.log.info('Son of Anton Daemon is running on port 3000');
    await startPolling();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
