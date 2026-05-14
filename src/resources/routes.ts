import { FastifyInstance } from 'fastify';
import { IssueService } from '../services/IssueService';
import { operations } from '../api';

export function registerRoutes(fastify: FastifyInstance, options: { issueService: IssueService }, done: (err?: Error) => void) {
  const { issueService } = options;

  fastify.get('/issues', async (request, reply) => {
    const query = request.query as operations["Issues_list"]["parameters"]["query"];
    const result = await issueService.getIssues(query?.cursor, query?.limit);
    return result;
  });

  fastify.get('/issues/:number', async (request, reply) => {
    const { number } = request.params as operations["Issues_get"]["parameters"]["path"];
    const issue = await issueService.getIssue(Number(number));
    if (!issue) {
      return reply.code(404).send({ error: 'Issue not found' });
    }
    return issue;
  });

  fastify.get('/issues/:number/sessions', async (request, reply) => {
    const { number } = request.params as operations["Issues_listSessions"]["parameters"]["path"];
    const query = request.query as operations["Issues_listSessions"]["parameters"]["query"];
    const result = await issueService.getSessions(Number(number), query?.cursor, query?.limit);
    if (!result) {
      return reply.code(404).send({ error: 'Issue or sessions not found' });
    }
    return result;
  });

  fastify.get('/issues/:number/sessions/:id', async (request, reply) => {
    const { number, id } = request.params as operations["Issues_getSessionContent"]["parameters"]["path"];
    const content = await issueService.getSessionContent(Number(number), id);
    if (content === undefined) {
      return reply.code(404).send({ error: 'Session content not found' });
    }
    return content;
  });

  done();
}
