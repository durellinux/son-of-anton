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

1. Setup the work environment:
   - Note that the workspace path `workspaces/{repo}` is already prepared, clean, and you are positioned in it on the correct `{{branch_name}}` branch.
2. Review comments:
   - The relevant unaddressed comments, files, lines, and diff hunks are provided directly in the prompt.
3. For each unaddressed comment:
   - Identify the file and line number.
   - Read the feedback.
   - Research the code around the comment.
   - Apply the requested changes.
   - Verify with tests: `npm test`.
   - React with 👍 to the comment:
     ```bash
     gh api repos/{{repo}}/pulls/comments/{{comment_id}}/reactions -f content='+1'
     ```
4. After addressing all comments:
   - Commit and push changes:
     ```bash
     git add .
     git commit -m "address review comments for PR #{{pr_number}}"
     git push origin {{branch_name}}
     ```
