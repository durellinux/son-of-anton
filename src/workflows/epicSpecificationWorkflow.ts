import * as restate from '@restatedev/restate-sdk';
import {
  fetchIssueDetails,
  updateRepository,
  addLabel,
  removeLabel,
} from './actions/issuesActions';
import { setupWorkspace, findPullRequest } from './actions/workspaceActions';
import { prReviewLoop } from './blocks/prReviewLoop';
import { labelBootstrappingBlock } from './blocks/labelBootstrappingBlock';
import { geminiLoop } from './blocks/geminiLoop';
import { IssueState } from '../../issueState';

export const epicSpecificationWorkflow = restate.workflow({
  name: 'EpicSpecificationWorkflow',
  handlers: {
    run: async (
      ctx: restate.WorkflowContext,
      params: { number: number; title: string; url: string; repository: string },
    ) => {
      const { number: issueNumber, repository: issueRepo } = params;
      const workflowUrl = `http://localhost:8080/visualize/EpicSpecificationWorkflow/${ctx.key}`;

      await labelBootstrappingBlock(ctx, issueRepo);

      // Transition labels
      await ctx.run('transition-labels', async () => {
        await addLabel(issueNumber, issueRepo, 'status:specifying');
        await removeLabel(issueNumber, issueRepo, 'status:triage');
      });

      // Update repository status to Specifying
      await ctx.run('update-repo-specifying', () =>
        updateRepository(issueNumber, params.title, params.url, IssueState.SPECIFYING, workflowUrl),
      );

      const ghIssue = await ctx.run('fetch-github-details', () =>
        fetchIssueDetails(issueNumber, issueRepo),
      );

      // Setup workspace
      await ctx.run('setup-workspace', () =>
        setupWorkspace(issueNumber, issueRepo, ghIssue.branch),
      );

      // Research and draft ADR
      const prompt = `Research requirements for the epic issue #${issueNumber}: "${params.title}" in ${issueRepo}.
Issue URL: ${params.url}

Description:
${ghIssue.body}

Tasks:
1. Research the codebase and requirements to understand the epic.
2. Draft an Architecture Decision Record (ADR) in the docs/adr/ directory.
3. Follow the existing ADR format (e.g., docs/adr/0001-ui-technology-selection.md).
4. Name the file with the next available number, e.g., 0004-new-feature.md.
5. Create a Pull Request with the new ADR.
6. The PR title should be "Spec: ${params.title}" and the body should include "Fixes #${issueNumber}".
7. Use the "son-of-anton" label for the PR.

Do not stop until the PR is created.`;

      await geminiLoop(ctx, 'research-and-draft-adr', issueNumber, prompt, 'specification');

      // Wait for PR
      const { prNumber, prUrl } = await ctx.run('find-pr', () =>
        findPullRequest(issueNumber, issueRepo),
      );

      const finalState = await prReviewLoop(ctx, prNumber, prUrl);

      // Update final repository status
      await ctx.run('update-final-status', () =>
        updateRepository(issueNumber, params.title, params.url, finalState, workflowUrl),
      );
    },
  },
});
