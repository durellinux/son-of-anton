# Anton Main Orchestrator

This is the main orchestrator for the Son of Anton daemon.

## Tasks

1. Call the `fetch-issues` skill to get the list of pending tasks.
2. For each issue in the returned list:
   - Call the `implement-fix` skill with the `issue_number`.
3. Report completion status.
