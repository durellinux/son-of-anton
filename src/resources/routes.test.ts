import Fastify from 'fastify';
import { registerRoutes } from './routes';
import { IssueRepository } from '../repositories/repositories';
import { Issue, Session, IssueStatus, PlanningSession } from '../api';
import { IssueService, Paged } from '../services/IssueService';

class MockRepository implements IssueRepository {
  async listIssues(cursor?: string, limit?: number): Promise<Issue[]> {
    return [{ number: 1, title: 'Test', url: '', status: IssueStatus.PLANNING }];
  }
  async getIssue(number: number): Promise<Issue | undefined> {
    if (number === 1) return { number: 1, title: 'Test', url: '', status: IssueStatus.PLANNING };
    return undefined;
  }
  async listSessions(issueNumber: number, cursor?: string, limit?: number): Promise<Session[] | undefined> {
    if (issueNumber === 1) return [{ id: 's1', type: 'planning', timestamp: '', status: 'success' }];
    return undefined;
  }
  async getSessionContent(issueNumber: number, sessionId: string): Promise<string | undefined> {
    if (issueNumber === 1 && sessionId === 's1') return 'content';
    return undefined;
  }
  async saveIssue(issue: Issue): Promise<void> {}
  async getPlanningSession(number: number): Promise<PlanningSession | undefined> { return undefined; }
  async savePlanningSession(session: PlanningSession): Promise<void> {}
  async deletePlanningSession(number: number): Promise<void> {}
}

async function test() {
  const fastify = Fastify();
  const repository = new MockRepository();
  const issueService = new IssueService(repository);
  fastify.register(registerRoutes, { issueService });

  console.log('Testing GET /issues...');
  let response = await fastify.inject({ method: 'GET', url: '/issues' });
  if (response.statusCode !== 200 || JSON.parse(response.body).items.length !== 1) {
    throw new Error('GET /issues failed');
  }

  console.log('Testing GET /issues/1...');
  response = await fastify.inject({ method: 'GET', url: '/issues/1' });
  if (response.statusCode !== 200 || JSON.parse(response.body).number !== 1) {
    throw new Error('GET /issues/1 failed');
  }

  console.log('Testing GET /issues/2 (404)...');
  response = await fastify.inject({ method: 'GET', url: '/issues/2' });
  if (response.statusCode !== 404) {
    throw new Error('GET /issues/2 should be 404');
  }

  console.log('Testing GET /issues/1/sessions...');
  response = await fastify.inject({ method: 'GET', url: '/issues/1/sessions' });
  if (response.statusCode !== 200 || JSON.parse(response.body).items.length !== 1) {
    throw new Error('GET /issues/1/sessions failed');
  }

  console.log('Testing GET /issues/1/sessions/s1...');
  response = await fastify.inject({ method: 'GET', url: '/issues/1/sessions/s1' });
  if (response.statusCode !== 200 || response.body !== 'content') {
    throw new Error('GET /issues/1/sessions/s1 failed');
  }

  console.log('All API tests passed!');
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
