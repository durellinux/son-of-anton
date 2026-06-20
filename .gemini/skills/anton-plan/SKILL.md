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
5. Save the proposed plan into a local planning session file:
   - Read the file `../../../plan.json` if it exists.
   - If it doesn't exist, create a new `history` array.
   - If it exists, parse the JSON and get the `history` array.
   - Append a new `PlanningStep` to the `history`:
     - `plan`: The plan you just created.
     - `timestamp`: Current timestamp in ISO format.
   - Save the updated (or new) `PlanningSession` back to `../../../plan.json`:
     - `number`: {issue_number} (as an integer)
     - `status`: "waiting_approval"
     - `history`: The updated history array.
