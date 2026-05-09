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

    if (issues.length === 0) {
      fastify.log.info('No issues found to process.');
      return;
    }

    fastify.log.info(`Found ${issues.length} issues to process.`);

    // 2. Serial Processing
    for (const issue of issues) {
      const issueNumber = issue.number;
      fastify.log.info(`Processing issue #${issueNumber}...`);

      // 3. Session Logging
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sessionDir = path.join('.anton', 'sessions', String(issueNumber), timestamp);
      await mkdir(sessionDir, { recursive: true });
      
      const sessionFilePath = path.join(sessionDir, 'session.txt');
      const logStream = createWriteStream(sessionFilePath);

      const subprocess = execa('gemini', [
        '-p', `use implement-fix skill for issue ${issueNumber}`,
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
        fastify.log.info(`Issue #${issueNumber} finished successfully`);
      } catch (error) {
        fastify.log.error(`Issue #${issueNumber} failed: %s`, error);
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
