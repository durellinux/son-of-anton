import * as restateClients from '@restatedev/restate-sdk-clients';
import { Issue, Session, PlanningSession, PlanningSessionStatus } from '../api';
import { IssueRepository } from '../repositories/repositories';
import { Workflow } from '@restatedev/restate-sdk';

export type Paged<T> = {
  items: T[];
  nextCursor?: string;
};

export class IssueService {
  constructor(
    private repository: IssueRepository,
    private restateClient: restateClients.IngressClient<any>,
  ) {}

  async getIssues(cursor?: string, limit: number = 10): Promise<Paged<Issue>> {
    const items = await this.repository.listIssues(cursor, limit + 1);
    const hasNextPage = items.length > limit;
    const pagedItems = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? items[limit].number.toString() : undefined;
    return {
      items: pagedItems,
      nextCursor,
    };
  }

  async getIssue(number: number): Promise<Issue | undefined> {
    return this.repository.getIssue(number);
  }

  async getSessions(
    issueNumber: number,
    cursor?: string,
    limit: number = 10,
  ): Promise<Paged<Session> | undefined> {
    const items = await this.repository.listSessions(issueNumber, cursor, limit + 1);
    if (!items) return undefined;
    const hasNextPage = items.length > limit;
    const pagedItems = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? items[limit].id : undefined;
    return {
      items: pagedItems,
      nextCursor,
    };
  }

  async getSessionContent(issueNumber: number, sessionId: string): Promise<string | undefined> {
    return this.repository.getSessionContent(issueNumber, sessionId);
  }

  async updateIssue(issue: Issue): Promise<void> {
    // Add business logic here if needed before saving
    return this.repository.saveIssue(issue);
  }

  async getPlanningSession(issueNumber: number): Promise<PlanningSession | undefined> {
    return this.repository.getPlanningSession(issueNumber);
  }

  async approvePlan(issueNumber: number): Promise<void> {
    const session = await this.repository.getPlanningSession(issueNumber);
    if (!session) throw new Error(`Planning session not found for issue ${issueNumber}`);
    session.status = PlanningSessionStatus.APPROVED;
    await this.repository.savePlanningSession(session);
  }

  async provideFeedback(issueNumber: number, feedback: string): Promise<void> {
    const session = await this.repository.getPlanningSession(issueNumber);
    if (!session) throw new Error(`Planning session not found for issue ${issueNumber}`);
    session.status = PlanningSessionStatus.NEEDS_REVISION;
    const lastStep = session.history[session.history.length - 1];
    if (lastStep) {
      lastStep.feedback = feedback;
    }
    await this.repository.savePlanningSession(session);
  }

  async deleteIssue(number: number): Promise<void> {
    const issue = await this.repository.getIssue(number);
    // 1. Terminate Restate workflow
    try {
      let workflowId = `issue-${number}`;
      let workflowName = 'IssueWorkflowV1';

      if (issue?.workflowUrl) {
        const urlParts = issue.workflowUrl.split('/');
        const id = urlParts.pop();
        const name = urlParts.pop();
        if (id && name) {
          workflowId = id;
          workflowName = name;
        }
      }

      const handle: any = await this.restateClient.workflowHandle(
        { name: workflowName } as any,
        workflowId,
      );
      await handle.terminate();
    } catch (e) {
      // Ignore if workflow doesn't exist or already terminated
      console.warn(`Failed to terminate workflow for issue ${number}:`, e);
    }

    // 2. Delete data from repository
    await this.repository.deleteSessions(number);
    await this.repository.deleteWorkspace(number);
    await this.repository.deleteIssue(number);
  }
}
