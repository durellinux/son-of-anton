---
name: anton-plan
description: Researches an issue and proposes a plan for its fix. Use when you have to plan a fix for a github issue.
---

## Parameters

- `issue_number`: The number of the issue to plan for.
- `repo`: The repository (e.g., `owner/repo`).

## Tasks

1. Research the codebase in the workspace (available at `workspaces/{repo}`) to understand the issue. The workspace setup and cloning has been managed automatically by the system.
2. Read the issue body and any previous plans/feedbacks provided in the prompt to gather requirements.
3. Plan the necessary changes.
4. Output the proposed plan clearly.

