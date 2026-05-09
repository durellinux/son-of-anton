# Handle Review Comments Skill

This skill addresses review comments on a Pull Request.

## Parameters

- `pr_number`: The number of the Pull Request.
- `branch_name`: The branch associated with the Pull Request.

## Tasks

1. Notify starting to address reviews:
   ```bash
   gh pr comment {{pr_number}} --body "I'm starting to address the review comments.

Made by: #son-of-anton"
   ```
2. Setup the work environment:
   - Check if worktree `.anton/worktrees/{{pr_number}}` exists.
   - If not, create it: `git worktree add .anton/worktrees/{{pr_number}} {{branch_name}}`.
   - If it exists, ensure it's on the correct branch: `cd .anton/worktrees/{{pr_number}} && git checkout {{branch_name}}`.
3. Fetch review comments:
   ```bash
   gh api repos/:owner/:repo/pulls/{{pr_number}}/comments
   ```
4. For each open/relevant comment:
   - Identify the file and line number.
   - Read the feedback.
   - Research the code around the comment.
   - Apply the requested changes.
   - Verify with tests: `npm test`.
5. After addressing all comments:
   - Commit and push changes:
     ```bash
     git add .
     git commit -m "address review comments for PR #{{pr_number}}"
     git push origin {{branch_name}}
     ```
6. Notify completion:
   ```bash
   gh pr comment {{pr_number}} --body "I've addressed the review comments and pushed the changes.

Made by: #son-of-anton"
   ```
