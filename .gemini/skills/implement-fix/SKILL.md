# Implement Fix Skill

This skill implements a fix for a specific GitHub issue.

## Parameters

- `issue_number`: The number of the issue to fix.

## Tasks

1. View the issue details:
   ```bash
   gh issue view {{issue_number}}
   ```
2. Notify starting work:
   ```bash
   gh issue comment {{issue_number}} --body "I'm starting to work on this issue.

Made by: #son-of-anton"
   ```
3. Research the codebase to understand the issue.
4. Plan the necessary changes.
5. Setup the work environment:
   - Check if branch `anton/{{issue_number}}` exists.
   - Check if worktree `.anton/worktrees/{{issue_number}}` exists.
   - If worktree exists, reuse it.
   - If branch exists but worktree doesn't, add worktree for existing branch: `git worktree add .anton/worktrees/{{issue_number}} anton/{{issue_number}}`.
   - If neither exists, create both: `git worktree add -b anton/{{issue_number}} .anton/worktrees/{{issue_number}}`.
6. If the branch already existed, check the current state of the code in the worktree and use it as a starting point.
7. Implement the fix in the worktree.
8. Apply edits using file-system tools.
9. Run tests to verify the fix:
   ```bash
   npm test
   ```
10. If tests fail, analyze the output and self-correct until they pass.
11. Commit changes and open a Pull Request:
    ```bash
    gh pr create --title "Fix issue #{{issue_number}}" --body "Automated fix by Anton.

Fixes #{{issue_number}}

Made by: #son-of-anton"
    ```
12. Remove the trigger label to prevent duplicate processing:
    ```bash
    gh issue edit {{issue_number}} --remove-label "son-of-anton"
    ```
