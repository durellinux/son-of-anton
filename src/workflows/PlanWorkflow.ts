import * as restate from "@restatedev/restate-sdk";
import { execa } from 'execa';
import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { determineIssueState, IssueState, Issue as GH_Issue } from '../../issue-state';
import { FileSystemIssueRepository } from '../repositories/FileSystemIssueRepository';
import { IssueStatus, Issue } from '../api';
import {executeGemini} from "./gemini";

const repository = new FileSystemIssueRepository();

function mapStateToStatus(state: IssueState): IssueStatus {
    switch (state) {
        case IssueState.YOLO: return IssueStatus.YOLO;
        case IssueState.NEEDS_PLANNING: return IssueStatus.PLANNING;
        case IssueState.NEEDS_IMPLEMENTATION: return IssueStatus.IMPLEMENTING;
        case IssueState.WAITING_PR_REVIEW: return IssueStatus.WAITING_PR_REVIEW;
        case IssueState.WAITING: return IssueStatus.WAITING_PLAN_REVIEW;
        case IssueState.CLOSED: return IssueStatus.CLOSED;
        case IssueState.MERGED: return IssueStatus.DONE;
        default: return IssueStatus.PLANNING;
    }
}

async function fetchIssueState(issueNumber: number, issueRepo: string) {
    const localPlanningSession = await repository.getPlanningSession(issueNumber);
    const { stdout: issueDetailsJson } = await execa('gh', ['issue', 'view', String(issueNumber), '-R', issueRepo, '--json', 'body,comments,state,pullRequests']);
    const issueDetails = JSON.parse(issueDetailsJson) as GH_Issue;

    const state = determineIssueState(issueDetails, localPlanningSession as any);
    
    // If planning session is approved, post to GitHub and clear local session
    if (localPlanningSession && localPlanningSession.status === 'approved') {
      const lastStep = localPlanningSession.history[localPlanningSession.history.length - 1];
      if (lastStep) {
        const commentBody = `${lastStep.plan}\n\n#son-of-anton-plan`;
        const { stdout: commentJson } = await execa('gh', ['api', `repos/${issueRepo}/issues/${issueNumber}/comments`, '-f', `body=${commentBody}`]);
        const comment = JSON.parse(commentJson);
        await execa('gh', ['api', `repos/${issueRepo}/issues/comments/${comment.id}/reactions`, '-f', 'content=+1']);
        
        // Delete the local planning session as it is now on GitHub
        await repository.deletePlanningSession(issueNumber);
      }
    }

    return { state };
}

async function updateRepository(issueNumber: number, title: string, url: string, state: IssueState, ctxKey: string) {
    const issue: Issue = {
        number: issueNumber,
        title: title,
        url: url,
        status: mapStateToStatus(state),
        workflowUrl: `http://localhost:8080/visualize/PlanWorkflow/${ctxKey}`
    };
    await repository.saveIssue(issue);
}

export const PlanWorkflow = restate.workflow({
  name: "PlanWorkflow",
  handlers: {
    run: async (ctx: restate.WorkflowContext, params: { number: number, title: string, url: string, repository: string, iteration: number }) => {
      const { number: issueNumber, repository: issueRepo, iteration } = params;

      const { state } = await ctx.run("fetch-issue-state", () => fetchIssueState(issueNumber, issueRepo));

      await ctx.run("update-repository", () => updateRepository(issueNumber, params.title, params.url, state, ctx.key));

      if (state === IssueState.CLOSED || state === IssueState.MERGED || state === IssueState.WAITING_PR_REVIEW) {
        return;
      }

      let prompt = '';
      if (state === IssueState.YOLO) {
        prompt = `Research, plan and implement the fix for issue ${issueNumber} on the repo ${issueRepo}. Follow the anton-plan and anton-implement skills workflow.`;
      } else if (state === IssueState.NEEDS_PLANNING) {
        prompt = `follow the anton-plan skill flow for issue ${issueNumber} on the repo ${issueRepo}`;
      }

      if (prompt) {
        await ctx.run("execute-gemini", () => executeGemini(issueNumber, prompt, iteration));
      }

      // Update state after planning
      const { state: finalState } = await ctx.run("fetch-issue-state-final", () => fetchIssueState(issueNumber, issueRepo));
      await ctx.run("update-repository-final", () => updateRepository(issueNumber, params.title, params.url, finalState, ctx.key));
    }
  }
});
