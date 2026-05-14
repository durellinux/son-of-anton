import { FastifyInstance } from 'fastify';
import { IssueService } from '../services/IssueService';
import { IssuesListData, IssuesGetData, IssuesListSessionsData, IssuesGetSessionContentData } from '../api';

export function registerRoutes(fastify: FastifyInstance, options: { issueService: IssueService }, done: (err?: Error) => void) {
  const { issueService } = options;

  fastify.get('/issues', async (request, reply) => {
    const query = request.query as IssuesListData;
    const result = await issueService.getIssues(query?.cursor, query?.limit);
    return result;
  });

  fastify.get('/issues/:number', async (request, reply) => {
    const { number } = request.params as IssuesGetData;
    const issue = await issueService.getIssue(Number(number));
    if (!issue) {
      return reply.code(404).send({ error: 'Issue not found' });
    }
    return issue;
  });

  fastify.get('/issues/:number/sessions', async (request, reply) => {
    const { number } = request.params as IssuesListSessionsData;
    const query = request.query as IssuesListSessionsData;
    const result = await issueService.getSessions(Number(number), query?.cursor, query?.limit);
    if (!result) {
      return reply.code(404).send({ error: 'Issue or sessions not found' });
    }
    return result;
  });

  fastify.get('/issues/:number/sessions/:id', async (request, reply) => {
    const { number, id } = request.params as IssuesGetSessionContentData;
    const content = await issueService.getSessionContent(Number(number), id);
    if (content === undefined) {
      return reply.code(404).send({ error: 'Session content not found' });
    }
    return content;
  });

  done();
}
