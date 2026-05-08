# Implement Fix Skill

This skill implements a fix for a specific GitHub issue.

## Parameters

- `issue_number`: The number of the issue to fix.

## Tasks

1. View the issue details:
   ```bash
   gh issue view {{issue_number}}
   ```
2. Research the codebase to understand the issue.
3. Plan the necessary changes.
4. Implement the fix in a separate branch and git worktree at .anton/worktrees/{issue_number}.
5. Apply edits using file-system tools.
6. Run tests to verify the fix:
   ```bash
   npm test
   ```
7. If tests fail, analyze the output and self-correct until they pass.
8. Create a new branch for the fix.
9. Commit changes and open a Pull Request:
   ```bash
   gh pr create --title "Fix issue #{{issue_number}}" --body "Automated fix by Anton."
   ```
