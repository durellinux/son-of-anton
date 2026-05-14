import { FastifyInstance } from 'fastify';
import { IssueService } from '../services/IssueService';
import { RouteHandlers } from '../api/fastify.gen';

export function registerRoutes(fastify: FastifyInstance, options: { issueService: IssueService }, done: (err?: Error) => void) {
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
  };

  fastify.get('/issues', handlers.issuesList);
  fastify.get('/issues/:number', handlers.issuesGet);
  fastify.get('/issues/:number/sessions', handlers.issuesListSessions);
  fastify.get('/issues/:number/sessions/:id', handlers.issuesGetSessionContent);

  done();
}
