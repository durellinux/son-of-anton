# Implement Skill

This skill implements an approved plan for a specific GitHub issue.

## Parameters

- `issue_number`: The number of the issue to fix.

## Tasks

1. Notify starting implementation:
   ```bash
   gh issue comment {{issue_number}} --body "Plan approved. I'm starting the implementation.

Made by: #son-of-anton"
   ```
2. Setup the work environment:
   - Check if branch `anton/{{issue_number}}` exists.
   - Check if worktree `.anton/worktrees/{{issue_number}}` exists.
   - If worktree exists, reuse it.
   - If branch exists but worktree doesn't, add worktree for existing branch: `git worktree add .anton/worktrees/{{issue_number}} anton/{{issue_number}}`.
   - If neither exists, create both: `git worktree add -b anton/{{issue_number}} .anton/worktrees/{{issue_number}}`.
3. If the branch already existed, check the current state of the code in the worktree and use it as a starting point.
4. Implement the fix in the worktree.
5. Apply edits using file-system tools.
6. Run tests to verify the fix (if available):
   ```bash
   npm test
   ```
7. If tests fail, analyze the output and self-correct until they pass.
8. Commit changes and open a Pull Request:
   ```bash
   gh pr create --label "son-of-anton" --title "Fix issue #{{issue_number}}" --body "Automated fix by Anton.

Fixes #{{issue_number}}

Made by: #son-of-anton"
   ```
9. Remove the trigger label to prevent duplicate processing:
   ```bash
   gh issue edit {{issue_number}} --remove-label "son-of-anton"
   ```
