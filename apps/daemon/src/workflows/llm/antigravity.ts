import path from 'node:path';
import os from 'node:os';
import { mkdir, cp } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { execa } from 'execa';
import { NoModelsAvailableError } from './types';

const MODELS = [
  'Gemini 3.6 Flash (Low)',
  'Gemini 3.5 Flash (Low)',
  'Gemini 3.1 Pro (Low)',
  'Claude Sonnet 4.6 (Thinking)',
  'Claude Opus 4.6 (Thinking)',
  'GPT-OSS 120B (Medium)',
];

// Map of model name to the timestamp (in ms) when it will be available again
const modelCooldowns = new Map<string, number>();

export async function executeAntigravity(
  id: number,
  prompt: string,
  type: string,
): Promise<string> {
  const issueDir = path.join('anton-data', String(id));
  const sessionDir = path.join(issueDir, 'sessions');

  while (true) {
    const selectedModel = MODELS.find((m) => (modelCooldowns.get(m) || 0) < Date.now());

    if (!selectedModel) {
      const earliestCooldown = Math.min(...Array.from(modelCooldowns.values()));
      const waitTime = Math.max(earliestCooldown - Date.now(), 1000);
      throw new NoModelsAvailableError(waitTime);
    }

    // Session Logging
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await mkdir(sessionDir, { recursive: true });

    // Copy .agents and GEMINI.md to issue directory
    try {
      await cp('.agents', path.join(issueDir, '.agents'), { recursive: true, force: true });
      await cp('.agents/AGENTS.md', path.join(issueDir, 'AGENTS.md'), { force: true });
    } catch (e) {
      console.error(`Failed to copy .agents or AGENTS.md to ${issueDir}:`, e);
    }

    const sessionFilePath = path.join(sessionDir, `${type}-${timestamp}.txt`);
    const logStream = createWriteStream(sessionFilePath);

    const instruction = `\n\nIMPORTANT: At the end of your run, you MUST output your final response for the user wrapped in <anton-response>...</anton-response> tags. For example:\n<anton-response>\nYour final response here\n</anton-response>`;
    const promptWithInstruction = `${prompt}${instruction}`;

    const hostAntonDataDir = process.env.HOST_ANTON_DATA_DIR
      ? path.resolve(process.env.HOST_ANTON_DATA_DIR)
      : path.resolve('anton-data');
    const hostIssueDir = path.join(hostAntonDataDir, String(id));
    const image = process.env.ANTON_AGENT_IMAGE || 'anton-sandbox:latest';

    const uid = process.getuid ? process.getuid() : undefined;
    const gid = process.getgid ? process.getgid() : undefined;
    const userArg = uid !== undefined && gid !== undefined ? `${uid}:${gid}` : undefined;

    // Create a local isolated .gemini structure for this issue run
    const issueGeminiDir = path.join(issueDir, '.gemini');
    await mkdir(path.join(issueGeminiDir, 'antigravity-cli'), { recursive: true });

    // Copy only the required files for authentication to isolate from host settings/history
    const hostOauthPath = path.join(os.homedir(), '.gemini/oauth_creds.json');
    const hostAccountsPath = path.join(os.homedir(), '.gemini/google_accounts.json');
    const hostTokenPath = path.join(
      os.homedir(),
      '.gemini/antigravity-cli/antigravity-oauth-token',
    );

    try {
      await cp(hostOauthPath, path.join(issueGeminiDir, 'oauth_creds.json'), { force: true });
    } catch {
      // ignore if missing
    }
    try {
      await cp(hostAccountsPath, path.join(issueGeminiDir, 'google_accounts.json'), {
        force: true,
      });
    } catch {
      // ignore if missing
    }
    try {
      await cp(
        hostTokenPath,
        path.join(issueGeminiDir, 'antigravity-cli/antigravity-oauth-token'),
        { force: true },
      );
    } catch {
      // ignore if missing
    }

    const dockerArgs = ['run', '--rm'];

    if (userArg) {
      dockerArgs.push('--user', userArg);
    }

    dockerArgs.push(
      '-v',
      `${hostIssueDir}:/workspace`,
      '-v',
      `${path.join(hostIssueDir, '.gemini')}:/tmp/.gemini`,
      '-w',
      '/workspace',
      '-e',
      `GH_TOKEN=${process.env.GH_TOKEN || ''}`,
      '-e',
      'HOME=/tmp',
      '-e',
      'GEMINI_DIR=/tmp/.gemini',
      image,
      'agy',
      '-p',
      promptWithInstruction,
      '--sandbox',
      '--dangerously-skip-permissions',
      '--model',
      selectedModel,
    );

    const subprocess = execa('docker', dockerArgs, {
      stdin: 'ignore',
      timeout: 30 * 60 * 1000,
    });

    let fullOutput = '';

    // Hook into the stream
    subprocess.stdout?.on('data', (chunk) => {
      const data = chunk.toString();
      fullOutput += data;
      logStream.write(data);
    });

    // Hook into the stream
    subprocess.stderr?.on('data', (chunk) => {
      const data = chunk.toString();
      logStream.write(data);
    });

    try {
      await subprocess;
      return extractAntonResponse(fullOutput);
    } catch (error: any) {
      if (error.timedOut) {
        logStream.write('\n\n[Timeout] Agent execution timed out after 30 minutes.\n');
        throw new Error('Agent execution timed out after 30 minutes.', { cause: error });
      }
      const output = (error.stdout || '') + (error.stderr || '') + (error.message || '');
      if (output.includes('429')) {
        let cooldownMs = 60 * 60 * 1000; // default 1 hour
        const match = output.match(/cooldown(?: period)?.*?:?\s*(\d+)\s*(ms|s|m|h)?/i);
        if (match) {
          const val = parseInt(match[1], 10);
          const unit = match[2]?.toLowerCase();
          if (unit === 'ms') cooldownMs = val;
          else if (unit === 'm') cooldownMs = val * 60 * 1000;
          else if (unit === 'h') cooldownMs = val * 60 * 60 * 1000;
          else cooldownMs = val * 1000;
        }
        modelCooldowns.set(selectedModel, Date.now() + cooldownMs);
        continue;
      }
      throw error;
    } finally {
      logStream.end();
    }
  }
}

function extractAntonResponse(output: string): string {
  const regex = /<anton-response>([\s\S]*?)<\/anton-response>/i;
  const match = output.match(regex);
  if (match) {
    return match[1].trim();
  }

  const openRegex = /<anton-response>([\s\S]*)$/i;
  const openMatch = output.match(openRegex);
  if (openMatch) {
    return openMatch[1].trim();
  }

  console.warn('Could not find <anton-response> tags in output, falling back to full output.');
  return output.trim();
}
