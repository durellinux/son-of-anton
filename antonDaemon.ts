import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import * as restate from '@restatedev/restate-sdk';
import * as restateClients from '@restatedev/restate-sdk-clients';
import { FileSystemIssueRepository } from './src/repositories/fileSystemIssueRepository';
import { registerRoutes } from './src/resources/routes';
import { IssueService } from './src/services/issueService';
import { issueWorkflowV1 } from './src/workflows/issueWorkflowV1';
import { epicSpecificationWorkflow } from './src/workflows/epicSpecificationWorkflow';
import { epicPlannerWorkflow } from './src/workflows/epicPlannerWorkflow';
import { GitHubPoller } from './src/services/githubPoller';

const RESTATE_URL = process.env.RESTATE_URL || 'http://localhost:8080';
const restateClient = restateClients.connect({ url: RESTATE_URL });

const repository = new FileSystemIssueRepository();
const issueService = new IssueService(repository, restateClient as any);

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

const githubPoller = new GitHubPoller(restateClient as any, fastify.log);
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Start the polling loop
async function startPolling() {
  while (true) {
    await githubPoller.poll();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

const start = async () => {
  try {
    // 1. Start Restate Service
    await restate
      .endpoint()
      .bind(issueWorkflowV1)
      .bind(epicSpecificationWorkflow)
      .bind(epicPlannerWorkflow)
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
