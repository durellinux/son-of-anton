# Handle Review Comments Skill

This skill addresses review comments on a GitHub Pull Request.

## Parameters

- `pr_number`: The number of the Pull Request to handle.

## Tasks

1. Fetch PR details to get the head branch name:
   ```bash
   gh pr view {{pr_number}} --json headRefName --jq '.headRefName'
   ```
2. Setup the work environment for the PR branch:
   - Worktree path: `.anton/worktrees/{{pr_number}}`
   - If worktree doesn't exist:
     - Check if branch `{{headRefName}}` exists locally.
     - If not, fetch it: `git fetch origin {{headRefName}}:{{headRefName}}`.
     - Add worktree: `git worktree add .anton/worktrees/{{pr_number}} {{headRefName}}`.
   - If worktree exists, reuse it.
3. Fetch review comments that are NOT resolved:
   ```bash
   gh api repos/:owner/:repo/pulls/{{pr_number}}/comments --jq '.[] | select(.pull_request_review_id != null) | {id, body, path, line, original_line, diff_hunk}'
   ```
   *Note: You may need to further filter or check if comments are already addressed.*
4. For each review comment:
   - Read the file at `path` in the worktree.
   - Analyze the `diff_hunk` and the `body` of the comment.
   - Apply the necessary changes to address the feedback.
   - Verify changes with tests: `npm test` (if available in the project).
5. After addressing all comments:
   - Commit the changes: `git commit -am "Address review comments for PR #{{pr_number}}"`
   - Push to origin: `git push origin {{headRefName}}`
   - Post a comment on the PR:
     ```bash
     gh pr comment {{pr_number}} --body "I've addressed the review comments in this PR.

Made by: #son-of-anton"
     ```
