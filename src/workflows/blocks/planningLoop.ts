// Iterate planning until plan is approved
import * as restate from '@restatedev/restate-sdk';
import { fetchIssueState, updateRepository } from '../actions/issuesActions';
import { IssueState } from '../../../issueState';
import {
  buildPlanningPrompt,
  commitPlan,
  getPlanningSession,
  savePlanningSession,
} from '../actions/planActions';
import { PlanningSessionStatus } from '../../../issueState';
import { geminiLoop } from './geminiLoop';

const MAX_PLAN_ITERATIONS = 1000;

export async function planningLoop(
  ctx: restate.WorkflowContext,
  issueNumber: number,
  issueRepo: string,
  title: string,
  issueUrl: string,
  workflowUrl: string,
  prefix: string = 'planning-loop',
  maxIterations: number = MAX_PLAN_ITERATIONS,
) {
  if (maxIterations <= 0 || maxIterations > MAX_PLAN_ITERATIONS) {
    maxIterations = MAX_PLAN_ITERATIONS;
  }

  let iteration = 0;
  while (iteration < maxIterations) {
    iteration++;

    const { state } = await ctx.run(`${prefix}-fetch-initial-issue-state-${iteration}`, () =>
      fetchIssueState(issueNumber, issueRepo),
    );

    if (state === IssueState.NEEDS_IMPLEMENTATION) {
      await ctx.run(`${prefix}-commit-plan-${iteration}`, () => commitPlan(issueNumber, issueRepo));
      return;
    }

    if (
      state !== IssueState.WAITING &&
      state !== IssueState.NEEDS_PLANNING &&
      state !== IssueState.YOLO
    ) {
      return;
    }

    if (state !== IssueState.WAITING) {
      await ctx.run(`${prefix}-update-repository-initial-${iteration}`, () =>
        updateRepository(issueNumber, title, issueUrl, state, workflowUrl),
      );

      const localPlanningSession = await ctx.run(
        `${prefix}-get-planning-session-${iteration}`,
        () => getPlanningSession(issueNumber),
      );

      const prompt = buildPlanningPrompt(issueNumber, issueRepo, state, localPlanningSession);
      const newPlan = await geminiLoop(
        ctx,
        `${prefix}-execute-gemini-${iteration}`,
        issueNumber,
        prompt,
        'plan',
      );

      await ctx.run(`${prefix}-save-planning-session-${iteration}`, async () => {
        const session = localPlanningSession || {
          number: issueNumber,
          status: PlanningSessionStatus.WAITING_APPROVAL,
          history: [],
        };
        session.history.push({
          plan: newPlan,
          timestamp: new Date().toISOString(),
        });
        session.status = PlanningSessionStatus.WAITING_APPROVAL;
        await savePlanningSession(session);
      });

      // Update state after planning
      await ctx.run(`${prefix}-update-repository-final-${iteration}`, () =>
        updateRepository(issueNumber, title, issueUrl, IssueState.WAITING, workflowUrl),
      );
    }

    await ctx.promise<void>('approval-' + iteration);
  }

  throw new Error(`Planning loop exceeded maximum iterations: ${maxIterations}`);
}
