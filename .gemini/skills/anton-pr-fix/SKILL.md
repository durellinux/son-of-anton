---
name: anton-pr-fix
description: This skill addresses review comments on a Pull Request. Use when you need to fix a PR comments.
---

## Parameters

- `pr_number`: The number of the Pull Request.
- `issue_number`: The number of the issue related to the Pull Request.
- `branch_name`: The branch associated with the Pull Request.
- `repo`: The repository (e.g., `owner/repo`).

## Tasks

1. Work in the pre-configured workspace path: `workspaces/{repo}`. The workspace setup and branch checkouts have already been managed automatically by the system. Ensure you are working on the `{{branch_name}}` branch.
2. Fetch review comments:
   ```bash
   gh api repos/{{repo}}/pulls/{{pr_number}}/comments
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
