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
   gh issue comment {{issue_number}} --body "I'm starting to work on this issue."
   ```
3. Remove the trigger label to prevent duplicate processing:
   ```bash
   gh issue edit {{issue_number}} --remove-label "son-of-anton"
   ```
4. Research the codebase to understand the issue.
5. Plan the necessary changes.
6. Implement the fix in a separate branch and git worktree at .anton/worktrees/{issue_number}.
7. Apply edits using file-system tools.
8. Run tests to verify the fix:
   ```bash
   npm test
   ```
9. If tests fail, analyze the output and self-correct until they pass.
10. Create a new branch for the fix.
11. Commit changes and open a Pull Request:
    ```bash
    gh pr create --title "Fix issue #{{issue_number}}" --body "Automated fix by Anton."
    ```
