---
name: anton-implement
description: This skill implements an approved plan for a specific GitHub issue. Use when you need to implement a plan for a specific issue.
---

## Parameters

- `issue_number`: The number of the issue to fix.
- `repo`: The repository (e.g., `owner/repo`).

## Tasks

1. Notify starting implementation:
   ```bash
   gh issue comment {{issue_number}} --body "Plan approved. I'm starting the implementation.

Made by: #son-of-anton"
   ```
2. Work in the pre-configured workspace path: `workspaces/{repo}`. The workspace setup and branching have already been managed automatically by the system. Ensure you are working on the `anton/{issue_number}` branch.
3. If the branch already existed, check the current state of the code in the workspace and use it as a starting point.
4. Implement the fix in the workspace.
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
