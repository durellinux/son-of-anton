import * as restate from '@restatedev/restate-sdk';
import {
  fetchIssueDetails,
  updateRepository,
  addLabel,
  removeLabel,
  createGitHubIssue,
} from './actions/issuesActions';
import { findPullRequest } from './actions/workspaceActions';
import { prReviewLoop } from './blocks/prReviewLoop';
import { labelBootstrappingBlock } from './blocks/labelBootstrappingBlock';
import { llmLoop } from './blocks/llmLoop';
import { setupWorkspaceBlock } from './blocks/setupWorkspaceBlock';
import { IssueState } from '../../issueState';
import { fetchPrFiles } from './actions/prActions';

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
      await setupWorkspaceBlock(ctx, issueNumber, issueRepo, ghIssue.branch);

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
6. The PR title should be "ADR: ${params.title}" and the body should include "Fixes #${issueNumber}".
7. Use the "son-of-anton" label for the PR.

Do not stop until the PR is created.`;

      await llmLoop(ctx, 'research-and-draft-adr', issueNumber, prompt, 'specification');

      // Wait for PR
      const { prNumber, prUrl } = await ctx.run('find-pr', () =>
        findPullRequest(issueNumber, issueRepo),
      );

      const finalState = await prReviewLoop(ctx, prNumber, prUrl);

      // Transition labels back
      await ctx.run('remove-specifying-label', () =>
        removeLabel(issueNumber, issueRepo, 'status:specifying'),
      );

      // Update final repository status
      await ctx.run('update-final-status', () =>
        updateRepository(issueNumber, params.title, params.url, finalState, workflowUrl),
      );

      if (finalState === IssueState.MERGED) {
        await ctx.run('create-planning-issue', async () => {
          const files = await fetchPrFiles(prNumber, issueRepo);
          const adrFile =
            files.find((f) => f.startsWith('docs/adr/')) || '{path to ADR file added by the PR}';

          const currentLabels = ghIssue.labels || [];
          const labelsToKeep = currentLabels.filter(
            (l) => l !== 'son-of-anton' && l !== 'type:epic',
          );
          const newLabels = Array.from(new Set([...labelsToKeep, 'type:task', 'status:planning']));

          await createGitHubIssue(
            issueRepo,
            `Plan ${params.title}`,
            `Plan the work for the ADR: ${adrFile}.\n\n#### Goal\nCreate the issues required to implement the ADR.\nEach ticket should be cohesive and clear in scope.\n`,
            newLabels,
          );
        });
      }
    },
  },
  options: {
    inactivityTimeout: { minutes: 30 },
    abortTimeout: { minutes: 30 },
  },
});
