# anton-pr-review

## Parameters
- `pr_number`: PR number
- `repo`: Repository owner/repo

## Tasks
1. Review the code of PR `pr_number` in `repo` using `gh pr diff`.
2. The goal is to review the PR as multiple persona:
   - a senior software developer: this one targeting code quality, performance, and maintainability
   - a security expert: aiming ad flagging potential security issues
   - a senior dev ops: to flag deployment issues (if any)
   The reviewer must focus on real problem, given one problem they need to categorize it as: LOW, MEDIUM, HIGH impact.
   Only MEDIUM and HIGH impact should end up in a comment on the PR.
3. Post review comments using `gh pr review`. The skill MUST not approve. It has to leave only comments. If no comments are necessary, then it doesn't do anything.
