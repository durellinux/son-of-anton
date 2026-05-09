# Fetch Issues Skill

This skill fetches open issues labeled with "son-of-anton" from GitHub.

## Tasks

1. Run the following command to get the list of issues:
   ```bash
   gh issue list --label "son-of-anton" --state open --json number,title
   ```
2. Return the JSON result. Do NOT search for issues using any other criteria or in any other locations. If the list is empty, the search is complete.
