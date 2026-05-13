import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { IssueRepository } from '../domain/repositories';

export function registerRoutes(fastify: FastifyInstance, options: { repository: IssueRepository }, done: (err?: Error) => void) {
  const { repository } = options;

  fastify.get('/issues', async (request, reply) => {
    const { cursor, limit } = request.query as { cursor?: string, limit?: string };
    const result = await repository.listIssues(cursor, limit ? parseInt(limit, 10) : undefined);
    return result;
  });

  fastify.get('/issues/:number', async (request, reply) => {
    const { number } = request.params as { number: string };
    const issue = await repository.getIssue(parseInt(number, 10));
    if (!issue) {
      return reply.code(404).send({ error: 'Issue not found' });
    }
    return issue;
  });

  fastify.get('/issues/:number/sessions', async (request, reply) => {
    const { number } = request.params as { number: string };
    const { cursor, limit } = request.query as { cursor?: string, limit?: string };
    const result = await repository.listSessions(parseInt(number, 10), cursor, limit ? parseInt(limit, 10) : undefined);
    if (!result) {
      return reply.code(404).send({ error: 'Issue or sessions not found' });
    }
    return result;
  });

  fastify.get('/issues/:number/sessions/:id', async (request, reply) => {
    const { number, id } = request.params as { number: string, id: string };
    const content = await repository.getSessionContent(parseInt(number, 10), id);
    if (content === undefined) {
      return reply.code(404).send({ error: 'Session content not found' });
    }
    return content;
  });

  done();
}
