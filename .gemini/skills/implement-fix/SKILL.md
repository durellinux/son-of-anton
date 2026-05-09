# Implement Fix Skill

This skill implements a fix for a specific GitHub issue with a human-in-the-loop planning phase.

## Parameters

- `issue_number`: The number of the issue to fix.

## Tasks

It is ESSENTIAL to follow the steps of the workflow below.
If the workflow is clear on the steps to take, do not try to be smart and investigate further, or deviate from it.

1. View the issue details and check for `#yolo` in the description:
   ```bash
   gh issue view {{issue_number}} --json body --jq '.body'
   ```
2. Determine target repository:
   - Extract the target repository (URL or `owner/repo`) from the issue description.
   - If a URL like `https://github.com/owner/repo` is found, the target is `owner/repo`.
   - If a pattern like `owner/repo` is found, that is the target.
   - If no repository is specified, default to the current repository (e.g., `durellinux/son-of-anton`).
3. Check if `#yolo` is present in the issue body. If yes, proceed to step 6 (Setup work environment).
4. If not in YOLO mode, check for existing plans and reactions:
   - Fetch comments and reactions for the current issue (in the current repo):
     ```bash
     gh api repos/:owner/:repo/issues/{{issue_number}}/comments --jq '.[] | {id, body, reactions}'
     ```
   - Find the latest comment containing `#son-of-anton-plan`.
   - If no plan exists:
     - Research the target codebase to understand the issue.
     - Plan the necessary changes.
     - Post the plan as an issue comment ending with `#son-of-anton-plan` on a new line.
     - STOP and wait for a human reaction.
   - If the latest plan exists:
     - If it has no reactions yet:
       - STOP and wait for a 👍 or 👎 reaction.
       - DO NOT proceed further with these instructions.
     - If it has a 👎 reaction (`.reactions."-1" > 0`):
       - Research the codebase and read all issue comments for feedback.
       - Generate a new plan addressing the feedback.
       - Post the new plan as an issue comment ending with `#son-of-anton-plan` on a new line.
       - STOP and wait for a human reaction.
     - If it has a 👍 reaction (`.reactions."+1" > 0`):
       - Proceed to step 6.
     NEVER start the implementation without a directly approved plan via a 👍 reaction on the issue comment.
5. Notify starting implementation (if not already notified for this phase):
   ```bash
   gh issue comment {{issue_number}} --body "Plan approved. I'm starting the implementation.

Made by: #son-of-anton"
   ```
6. Setup the work environment:
   - Workspace directory: `.anton/workspaces/{{repo_name}}/{{issue_number}}`
   - If the directory doesn't exist:
     - Clone the target repository: `git clone git@github.com:{{target_owner}}/{{target_repo}}.git .anton/workspaces/{{repo_name}}/{{issue_number}}`
   - Within the workspace directory:
     - Check if branch `anton/{{issue_number}}` exists.
     - If it doesn't exist, create it: `git checkout -b anton/{{issue_number}}`
     - If it exists, check it out: `git checkout anton/{{issue_number}}`
7. Implement the fix in the workspace directory.
8. Apply edits using file-system tools.
9. Run tests to verify the fix (if available) within the workspace directory:
   ```bash
   npm test
   ```
10. If tests fail, analyze the output and self-correct until they pass.
11. Commit changes and open a Pull Request in the target repository:
    ```bash
    gh pr create --repo {{target_owner}}/{{target_repo}} --label "son-of-anton" --title "Fix issue #{{issue_number}}" --body "Automated fix by Anton.

Fixes #{{issue_number}}

Made by: #son-of-anton"
    ```
12. Remove the trigger label from the ORIGINAL issue to prevent duplicate processing:
    ```bash
    gh issue edit {{issue_number}} --remove-label "son-of-anton"
    ```
