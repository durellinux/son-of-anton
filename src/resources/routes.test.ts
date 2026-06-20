import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { registerRoutes } from './routes';
import { IssueRepository } from '../repositories/repositories';
import { Issue, Session, IssueStatus, PlanningSession } from '../api';
import { IssueService } from '../services/issueService';

class MockRepository implements IssueRepository {
  async listIssues(_cursor?: string, _limit?: number): Promise<Issue[]> {
    return [{ number: 1, title: 'Test', url: '', status: IssueStatus.PLANNING }];
  }
  async getIssue(number: number): Promise<Issue | undefined> {
    if (number === 1) return { number: 1, title: 'Test', url: '', status: IssueStatus.PLANNING };
    return undefined;
  }
  async listSessions(
    issueNumber: number,
    _cursor?: string,
    _limit?: number,
  ): Promise<Session[] | undefined> {
    if (issueNumber === 1)
      return [{ id: 's1', type: 'planning', timestamp: '', status: 'success' }];
    return undefined;
  }
  async getSessionContent(issueNumber: number, sessionId: string): Promise<string | undefined> {
    if (issueNumber === 1 && sessionId === 's1') return 'content';
    return undefined;
  }
  async saveIssue(_issue: Issue): Promise<void> {}
  async getPlanningSession(_number: number): Promise<PlanningSession | undefined> {
    return undefined;
  }
  async savePlanningSession(_session: PlanningSession): Promise<void> {}
  async deletePlanningSession(_number: number): Promise<void> {}
  async deleteIssue(_number: number): Promise<void> {}
  async deleteSessions(_number: number): Promise<void> {}
  async deleteWorkspace(_number: number): Promise<void> {}
}

const mockRestateClient = {
  workflowClient: () => ({
    terminate: async () => {},
  }),
} as any;

describe('API routes', () => {
  it('handles GET /api/issues', async () => {
    const fastify = Fastify();
    const repository = new MockRepository();
    const issueService = new IssueService(repository, mockRestateClient);
    fastify.register(registerRoutes, { issueService });

    const response = await fastify.inject({ method: 'GET', url: '/api/issues' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).items.length).toBe(1);
  });

  it('handles GET /api/issues/1', async () => {
    const fastify = Fastify();
    const repository = new MockRepository();
    const issueService = new IssueService(repository, mockRestateClient);
    fastify.register(registerRoutes, { issueService });

    const response = await fastify.inject({ method: 'GET', url: '/api/issues/1' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).number).toBe(1);
  });

  it('returns 404 for GET /api/issues/2', async () => {
    const fastify = Fastify();
    const repository = new MockRepository();
    const issueService = new IssueService(repository, mockRestateClient);
    fastify.register(registerRoutes, { issueService });

    const response = await fastify.inject({ method: 'GET', url: '/api/issues/2' });
    expect(response.statusCode).toBe(404);
  });

  it('handles DELETE /api/issues/1', async () => {
    const fastify = Fastify();
    const repository = new MockRepository();
    const issueService = new IssueService(repository, mockRestateClient);
    fastify.register(registerRoutes, { issueService });

    const response = await fastify.inject({ method: 'DELETE', url: '/api/issues/1' });
    expect(response.statusCode).toBe(204);
  });

  it('handles GET /api/issues/1/sessions', async () => {
    const fastify = Fastify();
    const repository = new MockRepository();
    const issueService = new IssueService(repository, mockRestateClient);
    fastify.register(registerRoutes, { issueService });

    const response = await fastify.inject({ method: 'GET', url: '/api/issues/1/sessions' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).items.length).toBe(1);
  });

  it('handles GET /api/issues/1/sessions/s1', async () => {
    const fastify = Fastify();
    const repository = new MockRepository();
    const issueService = new IssueService(repository, mockRestateClient);
    fastify.register(registerRoutes, { issueService });

    const response = await fastify.inject({ method: 'GET', url: '/api/issues/1/sessions/s1' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('content');
  });
});
