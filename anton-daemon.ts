import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { execa } from 'execa';
import path from 'node:path';
import * as restate from "@restatedev/restate-sdk";
import * as restateClients from "@restatedev/restate-sdk-clients";
import { PullRequestBase } from './issue-state';
import { FileSystemIssueRepository } from './src/repositories/FileSystemIssueRepository';
import { registerRoutes } from './src/resources/routes';
import { IssueService } from './src/services/IssueService';
import { IssueWorkflow } from './src/workflows/IssueWorkflow';
import { PRWorkflow } from './src/workflows/PRWorkflow';

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
const RESTATE_URL = process.env.RESTATE_URL || "http://localhost:8080";

const restateClient = restateClients.connect({ url: RESTATE_URL });

async function runAnton() {
  fastify.log.info('Starting Anton iteration...');
  try {
    // 1. Fetch issues and PRs in Daemon
    const { stdout: issuesJson } = await execa('gh', ['search', 'issues', '--label', 'son-of-anton', '--state', 'open', '--json', 'number,title,repository,url', '--owner', '@me']);
    const basicIssues = JSON.parse(issuesJson) as { number: number, title: string, url: string, repository: { nameWithOwner: string } }[];

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
      fastify.log.info(`Pinging workflow for issue #${issueNumber}...`);

      const workflowClient = restateClient.workflowClient(IssueWorkflow, String(issueNumber));
      
      // Submit the workflow if not already running
      await workflowClient.workflowSubmit({
        number: issueNumber,
        title: basicIssue.title,
        url: basicIssue.url,
        repository: issueRepo
      });

      // Signal the workflow that something might have changed (e.g. new comments)
      await workflowClient.signalEvent();
    }

    // 3. Process PRs
    for (const pr of basicPRs) {
      fastify.log.info(`Pinging workflow for PR #${pr.number}...`);

      const workflowClient = restateClient.workflowClient(PRWorkflow, String(pr.number));
      
      await workflowClient.workflowSubmit({
        number: pr.number,
        url: pr.url
      });

      await workflowClient.signalEvent();
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
    // 1. Start Restate Service
    restate.endpoint()
      .bind(IssueWorkflow)
      .bind(PRWorkflow)
      .listen(9080);
    fastify.log.info('Restate service is running on port 9080');

    // 2. Start Fastify
    fastify.get('/health', async () => {
      return { status: 'ok' };
    });

    fastify.get('/ready', async () => {
      return { status: 'ok' };
    });

    fastify.register(fastifyStatic, {
      root: path.join(__dirname, 'ui', 'dist'),
      prefix: '/',
    });

    fastify.setNotFoundHandler((request, reply) => {
      reply.sendFile('index.html');
    });

    fastify.register(registerRoutes, { issueService });

    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    fastify.log.info('Son of Anton Daemon is running on port 3000');

    // 3. Start Polling
    await startPolling();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
