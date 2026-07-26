import * as restate from '@restatedev/restate-sdk';
import { Issue, PlanningSession } from '../api';
import { issueIndexObject } from './issueIndexObject';

export const issueObject = restate.object({
  name: 'IssueObject',
  handlers: {
    getIssue: async (ctx: restate.ObjectSharedContext) => {
      return (await ctx.get<Issue>('issue')) ?? undefined;
    },
    saveIssue: async (ctx: restate.ObjectContext, issue: Issue) => {
      ctx.set('issue', issue);
      await ctx.objectClient(issueIndexObject, 'global').addIssueNumber(issue.number);
    },
    deleteIssue: async (ctx: restate.ObjectContext) => {
      const issue = await ctx.get<Issue>('issue');
      const issueNum = issue?.number ?? parseInt(ctx.key, 10);
      if (!isNaN(issueNum)) {
        await ctx.objectClient(issueIndexObject, 'global').removeIssueNumber(issueNum);
      }
      ctx.clear('issue');
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
