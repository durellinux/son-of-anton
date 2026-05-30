import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { execa } from 'execa';
import path from 'node:path';
import * as restate from "@restatedev/restate-sdk";
import * as restateClients from "@restatedev/restate-sdk-clients";
import { PullRequestBase, determineIssueState, IssueState, Issue as GH_Issue, PullRequest, getUnaddressedPRComments, PRComment } from './issue-state';
import { FileSystemIssueRepository } from './src/repositories/FileSystemIssueRepository';
import { registerRoutes } from './src/resources/routes';
import { IssueService } from './src/services/IssueService';
import { PlanWorkflow } from './src/workflows/PlanWorkflow';
import { ImplementationWorkflow } from './src/workflows/ImplementationWorkflow';
import { PRWorkflow } from './src/workflows/PRWorkflow';
import {PlanWorkflowV2} from "./src/workflows/PlanWorkflowV2";

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

    const { stdout: prsJson } = await execa('gh', ['search', 'prs', '--label', 'son-of-anton', '--state', 'open', '--json', 'number,url,repository']);
    const basicPRs = JSON.parse(prsJson) as (PullRequestBase & { repository: { nameWithOwner: string } })[];

    if (basicIssues.length === 0 && basicPRs.length === 0) {
      fastify.log.info('No issues or PRs found to process.');
      return;
    }

    fastify.log.info(`Found ${basicIssues.length} issues and ${basicPRs.length} PRs to process.`);

    // 2. Process Issues
    for (const basicIssue of basicIssues) {
      const issueNumber = basicIssue.number;
      const issueRepo = basicIssue.repository.nameWithOwner;
      
      const localPlanningSession = await repository.getPlanningSession(issueNumber);
      const { stdout: issueDetailsJson } = await execa('gh', ['issue', 'view', String(issueNumber), '-R', issueRepo, '--json', 'body,comments,state']);
      const issueDetails = JSON.parse(issueDetailsJson) as GH_Issue;

      const state = determineIssueState(issueDetails, localPlanningSession as any);
      
      if ((state === IssueState.NEEDS_PLANNING || state === IssueState.YOLO) && !localPlanningSession) {
        const workflowId = state === IssueState.YOLO ? `plan-${issueNumber}-yolo` : `plan-${issueNumber}`;
        fastify.log.info(`Submitting PlanWorkflow for issue #${issueNumber} (id: ${workflowId})...`);

        const workflowClient = restateClient.workflowClient(PlanWorkflowV2, workflowId);
        await workflowClient.workflowSubmit({
          number: issueNumber,
          title: basicIssue.title,
          url: basicIssue.url,
          repository: issueRepo
        });
      } else if (state === IssueState.NEEDS_IMPLEMENTATION) {
        fastify.log.info(`Submitting ImplementationWorkflow for issue #${issueNumber}...`);
        const workflowClient = restateClient.workflowClient(ImplementationWorkflow, `implement-${issueNumber}`);
        await workflowClient.workflowSubmit({
          number: issueNumber,
          title: basicIssue.title,
          url: basicIssue.url,
          repository: issueRepo
        });
      }
    }

    // 3. Process PRs
    for (const pr of basicPRs) {
      const prNumber = pr.number;
      const fullRepo = pr.repository.nameWithOwner;

      const { stdout: prDetailsJson } = await execa('gh', ['pr', 'view', String(prNumber), '-R', fullRepo, '--json', 'number,headRefName,url,reviewDecision,state']);
      const prDetails = JSON.parse(prDetailsJson) as PullRequest;

      const { stdout: commentsJson } = await execa('gh', ['api', `repos/${fullRepo}/pulls/${prNumber}/comments`]);
      const comments = JSON.parse(commentsJson) as PRComment[];
      const unaddressedCommentIds = getUnaddressedPRComments(comments);

      if (unaddressedCommentIds.length > 0) {
        const issueMatch = prDetails.headRefName.match(/anton\/(\d+)/);
        const issueId = issueMatch ? issueMatch[1] : `pr-${prNumber}`;
        const workflowId = `pr-review-${issueId}-${comments.length}`;
        
        fastify.log.info(`Submitting PRWorkflow for PR #${prNumber} (id: ${workflowId})...`);

        const workflowClient = restateClient.workflowClient(PRWorkflow, workflowId);
        await workflowClient.workflowSubmit({
          number: pr.number,
          url: pr.url
        });
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
    // 1. Start Restate Service
    await restate.endpoint()
      .bind(PlanWorkflow)
      .bind(PlanWorkflowV2)
      .bind(ImplementationWorkflow)
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
