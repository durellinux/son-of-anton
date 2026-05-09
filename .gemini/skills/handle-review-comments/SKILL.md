# Handle Review Comments Skill

This skill addresses review comments on a Pull Request.

## Parameters

- `pr_number`: The number of the Pull Request.
- `branch_name`: The branch associated with the Pull Request.

## Tasks

1. Setup the work environment:
   - Check if worktree `.anton/worktrees/{{pr_number}}` exists.
   - If not, create it: `git worktree add .anton/worktrees/{{pr_number}} {{branch_name}}`.
   - If it exists, ensure it's on the correct branch: `cd .anton/worktrees/{{pr_number}} && git checkout {{branch_name}}`.
2. Fetch review comments:
   ```bash
   gh api repos/:owner/:repo/pulls/{{pr_number}}/comments
   ```
3. For each open/relevant comment (skip comments with 👍 already applied):
   - Identify the file and line number.
   - Read the feedback.
   - Research the code around the comment.
   - Apply the requested changes.
   - Verify with tests: `npm test`.
   - React with 👍 to the comment:
     ```bash
     gh api repos/:owner/:repo/pulls/comments/{{comment_id}}/reactions -f content='+1'
     ```
4. After addressing all comments:
   - Commit and push changes:
     ```bash
     git add .
     git commit -m "address review comments for PR #{{pr_number}}"
     git push origin {{branch_name}}
     ```
