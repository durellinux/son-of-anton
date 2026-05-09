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
2. Check if `#yolo` is present. If yes, proceed to step 5 (Setup work environment).
3. If not in YOLO mode, check for existing plans and reactions:
   - Fetch comments and reactions (replace `:owner/:repo` with the current repository):
     ```bash
     gh api repos/:owner/:repo/issues/{{issue_number}}/comments --jq '.[] | {id, body, reactions}'
     ```
   - Find the latest comment containing `#son-of-anton-plan`.
   - If no plan exists:
     - Research the codebase to understand the issue.
     - Plan the necessary changes.
     - Post the plan as an issue comment ending with `#son-of-anton-plan` on a new line.
     - STOP and wait for a human reaction.
   - If the latest plan exists:
     - If it has no reactions yet:
       - STOP and wait for a 👍 or 👎 reaction.
       - DO NOT proceed further with these instructions
       - It's normal to have to wait, humans are slow. Chill for a bit and work on the next issue on the list.
     - If it has a 👎 reaction (`.reactions."-1" > 0`):
       - Research the codebase and read all issue comments for feedback.
       - Generate a new plan addressing the feedback.
       - Post the new plan as an issue comment ending with `#son-of-anton-plan` on a new line.
       - STOP and wait for a human reaction.
     - If it has a 👍 reaction (`.reactions."+1" > 0`):
       - Proceed to step 5.
     NEVER start the implementation without a directly approved plan via a 👍 reaction on the issue comment.
4. Notify starting implementation (if not already notified for this phase):
   ```bash
   gh issue comment {{issue_number}} --body "Plan approved. I'm starting the implementation.

Made by: #son-of-anton"
   ```
5. Setup the work environment:
   - Check if branch `anton/{{issue_number}}` exists.
   - Check if worktree `.anton/worktrees/{{issue_number}}` exists.
   - If worktree exists, reuse it.
   - If branch exists but worktree doesn't, add worktree for existing branch: `git worktree add .anton/worktrees/{{issue_number}} anton/{{issue_number}}`.
   - If neither exists, create both: `git worktree add -b anton/{{issue_number}} .anton/worktrees/{{issue_number}}`.
6. If the branch already existed, check the current state of the code in the worktree and use it as a starting point.
7. Implement the fix in the worktree.
8. Apply edits using file-system tools.
9. Run tests to verify the fix (if available):
   ```bash
   npm test
   ```
10. If tests fail, analyze the output and self-correct until they pass.
11. Commit changes and open a Pull Request:
    ```bash
    gh pr create --label "son-of-anton" --title "Fix issue #{{issue_number}}" --body "Automated fix by Anton.

Fixes #{{issue_number}}

Made by: #son-of-anton"
    ```
12. Remove the trigger label to prevent duplicate processing:
    ```bash
    gh issue edit {{issue_number}} --remove-label "son-of-anton"
    ```
