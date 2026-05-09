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
2. Repository Detection:
   - Identify the target repository from the issue description or comments.
   - Look for URLs (e.g., https://github.com/owner/repo) or shorthand (e.g., owner/repo).
   - If no repository is explicitly mentioned, default to the current repository.
3. Setup the work environment:
   - Define the workspace path: `.anton/workspaces/{repo-name}/{{issue_number}}`.
   - Check if the workspace directory exists.
   - If it doesn't exist:
     - Clone the repository: `git clone https://github.com/{owner}/{repo} .anton/workspaces/{repo-name}/{{issue_number}}`.
     - Create a new branch: `git checkout -b anton/{{issue_number}}` (inside the workspace).
   - If it exists:
     - Reuse the existing clone.
     - Ensure you are on the `anton/{{issue_number}}` branch.
4. If the branch already existed, check the current state of the code in the workspace and use it as a starting point.
5. Implement the fix in the workspace.
6. Apply edits using file-system tools.
7. Run tests to verify the fix (if available):
   ```bash
   npm test
   ```
8. If tests fail, analyze the output and self-correct until they pass.
9. Commit changes and open a Pull Request:
   ```bash
   gh pr create --label "son-of-anton" --title "Fix issue #{{issue_number}}" --body "Automated fix by Anton.

Fixes #{{issue_number}}

Made by: #son-of-anton"
   ```
10. Remove the trigger label to prevent duplicate processing:
    ```bash
    gh issue edit {{issue_number}} --remove-label "son-of-anton"
    ```
