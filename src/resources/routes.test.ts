import { describe, it, expect, beforeAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
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

describe('Routes API', () => {
  let fastify: FastifyInstance;

  beforeAll(() => {
    fastify = Fastify();
    const repository = new MockRepository();
    const issueService = new IssueService(repository, mockRestateClient);
    fastify.register(registerRoutes, { issueService });
  });

  it('GET /api/issues should list issues', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/api/issues' });
    expect(response.statusCode).toBe(200);
    const parsed = JSON.parse(response.body);
    expect(parsed.items.length).toBe(1);
  });

  it('GET /api/issues/1 should return the specific issue', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/api/issues/1' });
    expect(response.statusCode).toBe(200);
    const parsed = JSON.parse(response.body);
    expect(parsed.number).toBe(1);
  });

  it('GET /api/issues/2 should return 404', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/api/issues/2' });
    expect(response.statusCode).toBe(404);
  });

  it('DELETE /api/issues/1 should return 204', async () => {
    const response = await fastify.inject({ method: 'DELETE', url: '/api/issues/1' });
    expect(response.statusCode).toBe(204);
  });

  it('GET /api/issues/1/sessions should list sessions', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/api/issues/1/sessions' });
    expect(response.statusCode).toBe(200);
    const parsed = JSON.parse(response.body);
    expect(parsed.items.length).toBe(1);
  });

  it('GET /api/issues/1/sessions/s1 should return session content', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/api/issues/1/sessions/s1' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('content');
  });
});

