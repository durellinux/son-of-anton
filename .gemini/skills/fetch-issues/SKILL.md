# Fetch Issues Skill

This skill fetches open issues labeled with "anton-fix" from GitHub.

## Tasks

1. Run the following command to get the list of issues:
   ```bash
   gh issue list --label "anton-fix" --state open --json number,title
   ```
2. Return the JSON result.
