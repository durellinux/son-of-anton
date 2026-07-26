import * as restate from '@restatedev/restate-sdk';
import { Issue, PlanningSession } from '../api';

export const issueIndexObject = restate.object({
  name: 'IssueIndexObject',
  handlers: {
    addIssueNumber: async (ctx: restate.ObjectContext, number: number) => {
      const numbers = (await ctx.get<number[]>('issueNumbers')) ?? [];
      if (!numbers.includes(number)) {
        numbers.push(number);
        ctx.set('issueNumbers', numbers);
      }
    },
    removeIssueNumber: async (ctx: restate.ObjectContext, number: number) => {
      const numbers = (await ctx.get<number[]>('issueNumbers')) ?? [];
      const index = numbers.indexOf(number);
      if (index !== -1) {
        numbers.splice(index, 1);
        ctx.set('issueNumbers', numbers);
      }
    },
    listIssues: async (
      ctx: restate.ObjectSharedContext,
      req?: { cursor?: string; limit?: number },
    ) => {
      const numbers = (await ctx.get<number[]>('issueNumbers')) ?? [];
      const sorted = [...numbers].sort((a, b) => b - a);
      const cursor = req?.cursor;
      const limit = req?.limit ?? 100;
      const startIndex = cursor ? sorted.indexOf(parseInt(cursor, 10)) : 0;
      if (startIndex === -1 && cursor) return [];
      return sorted.slice(startIndex, startIndex + limit);
    },
  },
});

export const issueObject = restate.object({
  name: 'IssueObject',
  handlers: {
    getIssue: async (ctx: restate.ObjectSharedContext) => {
      return (await ctx.get<Issue>('issue')) ?? undefined;
    },
    saveIssue: async (ctx: restate.ObjectContext, issue: Issue) => {
      ctx.set('issue', issue);
      ctx.objectClient(issueIndexObject, 'global').addIssueNumber(issue.number);
    },
    deleteIssue: async (ctx: restate.ObjectContext) => {
      const issue = await ctx.get<Issue>('issue');
      ctx.clear('issue');
      const issueNum = issue?.number ?? parseInt(ctx.key, 10);
      if (!isNaN(issueNum)) {
        ctx.objectClient(issueIndexObject, 'global').removeIssueNumber(issueNum);
      }
    },
    getPlanningSession: async (ctx: restate.ObjectSharedContext) => {
      return (await ctx.get<PlanningSession>('plan')) ?? undefined;
    },
    savePlanningSession: async (ctx: restate.ObjectContext, session: PlanningSession) => {
      ctx.set('plan', session);
    },
    deletePlanningSession: async (ctx: restate.ObjectContext) => {
      ctx.clear('plan');
    },
  },
});
