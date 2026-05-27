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
    const { stdout: issueDetailsJson } = await execa('gh', ['issue', 'view', String(issueNumber), '-R', issueRepo, '--json', 'body,comments,state']);
    const issueDetails = JSON.parse(issueDetailsJson) as GH_Issue;

    const state = determineIssueState(issueDetails, localPlanningSession as any);
    return { state };
}

async function updateRepository(issueNumber: number, title: string, url: string, state: IssueState, ctxKey: string) {
    const issue: Issue = {
        number: issueNumber,
        title: title,
        url: url,
        status: mapStateToStatus(state),
        workflowUrl: `http://localhost:8080/visualize/ImplementationWorkflow/${ctxKey}`
    };
    await repository.saveIssue(issue);
}

export const ImplementationWorkflow = restate.workflow({
  name: "ImplementationWorkflow",
  handlers: {
    run: async (ctx: restate.WorkflowContext, params: { number: number, title: string, url: string, repository: string }) => {
      const { number: issueNumber, repository: issueRepo } = params;

      const { state } = await ctx.run("fetch-issue-state", () => fetchIssueState(issueNumber, issueRepo));

      await ctx.run("update-repository", () => updateRepository(issueNumber, params.title, params.url, state, ctx.key));

      if (state !== IssueState.NEEDS_IMPLEMENTATION) {
        return;
      }

      const prompt = `follow the anton-implement skill flow for issue ${issueNumber} on the repo ${issueRepo}`;
      await ctx.run("execute-gemini", () => executeGemini(issueNumber, prompt, 'implement'));
      
      // Update state after implementation
      const { state: finalState } = await ctx.run("fetch-issue-state-final", () => fetchIssueState(issueNumber, issueRepo));
      await ctx.run("update-repository-final", () => updateRepository(issueNumber, params.title, params.url, finalState, ctx.key));
    }
  }
});
