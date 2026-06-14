# anton-pr-review

## Parameters
- `pr_number`: PR number
- `repo`: Repository owner/repo

## Tasks
1. Review the code of PR `pr_number` in `repo` using `gh pr diff`.
2. Post review comments using `gh pr review`.
3. If everything looks good, approve the PR with `gh pr review --approve`.