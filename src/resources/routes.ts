import { FastifyInstance } from 'fastify';
import { IssueService } from '../services/issueService';
import { RouteHandlers } from '../api/fastify.gen';

export function registerRoutes(
  fastify: FastifyInstance,
  options: { issueService: IssueService },
  done: (err?: Error) => void,
) {
  const { issueService } = options;

  const handlers: RouteHandlers = {
    issuesList: async (request, reply) => {
      const { cursor, limit } = request.query || {};
      const result = await issueService.getIssues(cursor, limit);
      await reply.send(result as any);
    },
    issuesGet: async (request, reply) => {
      const { number } = request.params;
      const issue = await issueService.getIssue(Number(number));
      if (!issue) {
        await reply.code(404).send({ error: 'Issue not found' } as any);
        return;
      }
      await reply.send(issue as any);
    },
    issuesDelete: async (request, reply) => {
      const { number } = request.params;
      try {
        await issueService.deleteIssue(Number(number));
        await reply.code(204).send();
      } catch (e) {
        await reply.code(404).send({ error: (e as Error).message } as any);
      }
    },
    issuesListSessions: async (request, reply) => {
      const { number } = request.params;
      const { cursor, limit } = request.query || {};
      const result = await issueService.getSessions(Number(number), cursor, limit);
      if (!result) {
        await reply.code(404).send({ error: 'Issue or sessions not found' } as any);
        return;
      }
      await reply.send(result as any);
    },
    issuesGetSessionContent: async (request, reply) => {
      const { number, id } = request.params;
      const content = await issueService.getSessionContent(Number(number), id);
      if (content === undefined) {
        await reply.code(404).send({ error: 'Session content not found' } as any);
        return;
      }
      await reply.send(content as any);
    },
    issuesGetPlanningSession: async (request, reply) => {
      const { number } = request.params;
      const session = await issueService.getPlanningSession(Number(number));
      if (!session) {
        await reply.code(404).send({ error: 'Planning session not found' } as any);
        return;
      }
      await reply.send(session as any);
    },
    issuesApprovePlan: async (request, reply) => {
      const { number } = request.params;
      try {
        await issueService.approvePlan(Number(number));
        await reply.code(204).send();
      } catch (e) {
        await reply.code(404).send({ error: (e as Error).message } as any);
      }
    },
    issuesProvideFeedback: async (request, reply) => {
      const { number } = request.params;
      const { feedback } = (request.body as any) || {};
      try {
        await issueService.provideFeedback(Number(number), feedback);
        await reply.code(204).send();
      } catch (e) {
        await reply.code(404).send({ error: (e as Error).message } as any);
      }
    },
  };

  fastify.get('/api/issues', handlers.issuesList);
  fastify.get('/api/issues/:number', handlers.issuesGet);
  fastify.delete('/api/issues/:number', handlers.issuesDelete);
  fastify.get('/api/issues/:number/sessions', handlers.issuesListSessions);
  fastify.get('/api/issues/:number/sessions/:id', handlers.issuesGetSessionContent);
  fastify.get('/api/issues/:number/planning', handlers.issuesGetPlanningSession);
  fastify.post('/api/issues/:number/planning/approve', handlers.issuesApprovePlan);
  fastify.post('/api/issues/:number/planning/feedback', handlers.issuesProvideFeedback);

  done();
}
