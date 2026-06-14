import fastify from 'fastify';
import * as restate from '@restatedev/restate-sdk';
import { FileSystemIssueRepository } from './src/repositories/fileSystemIssueRepository';
import { registerRoutes } from './src/resources/routes';
import { IssueService } from './src/services/issueService';
import { issueWorkflowV1 } from './src/workflows/issueWorkflowV1';
import { epicSpecificationWorkflow } from './src/workflows/epicSpecificationWorkflow';
import { epicPlannerWorkflow } from './src/workflows/epicPlannerWorkflow';
import { implementationAgentWorkflow } from './src/workflows/implementationAgentWorkflow';
import { prLifecycleWorkflow } from './src/workflows/prLifecycleWorkflow';
import { GitHubPoller } from './src/services/githubPoller';

const RESTATE_URL = process.env.RESTATE_URL || 'http://localhost:8080';

const start = async () => {
  const server = fastify({
    logger: true,
  });

  const issueRepository = new FileSystemIssueRepository();
  const issueService = new IssueService(issueRepository);

  await registerRoutes(server, issueService);

  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`Server listening on ${port}`);

    // Start polling for GitHub issues
    const githubPoller = new GitHubPoller(RESTATE_URL);
    githubPoller.start();

    // Start Restate server
    restate
      .endpoint()
      .bind(issueWorkflowV1)
      .bind(epicSpecificationWorkflow)
      .bind(epicPlannerWorkflow)
      .bind(implementationAgentWorkflow)
      .bind(prLifecycleWorkflow)
      .listen(9080);

    fastify({ logger: true }).log.info('Restate service is running on port 9080');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
