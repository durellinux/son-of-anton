# Plan Skill

This skill researches an issue and proposes a plan for its fix.

## Parameters

- `issue_number`: The number of the issue to plan for.

## Tasks

1. Repository Detection:
   - Identify the target repository from the issue URL (e.g., `https://github.com/{owner}/{repo}/issues/{issue_number}`).
   - If no repository is explicitly identified from the URL or description, abort the process.
2. Setup the work environment:
   - Define the workspace path: `.anton/workspaces/{repo-name}/{{issue_number}}`.
   - Check if the workspace directory exists.
   - If it doesn't exist:
     - Clone the repository: `git clone https://github.com/{owner}/{repo} .anton/workspaces/{repo-name}/{{issue_number}}`.
     - `cd .anton/workspaces/{repo-name}/{{issue_number}}`.
   - If it exists:
     - `cd .anton/workspaces/{repo-name}/{{issue_number}}`.
     - Reuse the existing clone.
3. Research the codebase to understand the issue.
4. Read the issue body and all comments to gather requirements and feedback from previous plans (if any).
5. Plan the necessary changes.
6. Post the plan as an issue comment ending with `#son-of-anton-plan` on a new line.
