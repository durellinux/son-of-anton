---
name: anton-plan
description: Researches an issue and proposes a plan for its fix. Use when you have to plan a fix for a github issue.
---

## Parameters

- `issue_number`: The number of the issue to plan for.
- `repo`: The repository (e.g., `owner/repo`).

## Tasks

1. Research the codebase to understand the issue. Note that the workspace under `workspaces/{repo}` is already prepared, clean, and you are positioned in it.
3. Read the issue body and all comments to gather requirements and feedback from previous plans (if any).
4. Plan the necessary changes.
5. Output the proposed plan in your final response for the user.
