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
2. Setup the work environment:
   - Define the workspace path: `.anton/workspaces/{issue_number}/{repo}`.
   - Check if the workspace directory exists.
   - If it doesn't exist:
     - Clone the repository: `git clone https://github.com/{repo} .anton/workspaces/{issue_number}/{repo}`.
     - `cd .anton/workspaces/{issue_number}/{repo}`.
     - Create a new branch: `git checkout -b anton/{issue_number}`.
   - If it exists:
     - `cd .anton/workspaces/{issue_number}/{repo}`.
     - Reuse the existing clone.
     - Ensure you are on the `anton/{issue_number}` branch.
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
9. Remove the trigger label to prevent duplicate processing:
    ```bash
    gh issue edit {{issue_number}} --remove-label "son-of-anton"
    ```
