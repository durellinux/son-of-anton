# Son of Anton

Son of Anton is an autonomous, E2E AI-assisted development daemon. It leverages the Gemini CLI to periodically poll for tasks (GitHub issues) and implement fixes automatically.

## How it Works

The daemon runs a polling loop that:
1. **Fetches** open issues labeled `son-of-anton`.
2. **Orchestrates** the implementation of fixes for each issue using specialized skills.
3. **Automatically** creates Pull Requests with the proposed changes.

## Setup

1. Install dependencies:
   ```bash
   yarn install
   ```
2. Ensure `gh` CLI is authenticated and configured.
3. Ensure `gemini` CLI is installed and configured.

## Usage

Start the daemon:
```bash
npx ts-node anton-daemon.ts
```

The daemon will listen on port 3000 and start its polling loop every 5 minutes.
