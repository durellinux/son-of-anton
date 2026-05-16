# Plan Skill

This skill researches an issue and proposes a plan for its fix.

## Parameters

- `issue_number`: The number of the issue to plan for.
- `repo`: The repository (e.g., `owner/repo`).

## Tasks

1. Setup the work environment:
   - Define the workspace path: `.anton/workspaces/{issue_number}/{repo}`.
   - Check if the workspace directory exists.
   - If it doesn't exist:
     - Clone the repository: `git clone https://github.com/{repo} .anton/workspaces/{issue_number}/{repo}`.
     - `cd .anton/workspaces/{issue_number}/{repo}`.
   - If it exists:
     - `cd .anton/workspaces/{issue_number}/{repo}`.
     - Reuse the existing clone.
2. Research the codebase to understand the issue.
3. Read the issue body and all comments to gather requirements and feedback from previous plans (if any).
4. Plan the necessary changes.
5. Post the plan as an issue comment ending with `#son-of-anton-plan` on a new line.
