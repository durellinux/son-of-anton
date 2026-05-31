import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { execa } from 'execa';

const MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-flash-lite',
];

// Map of model name to the timestamp (in ms) when it will be available again
const modelCooldowns = new Map<string, number>();

export class NoModelsAvailableError extends Error {
  constructor(public waitTimeMs: number) {
    super(`No models available. Wait time: ${waitTimeMs}ms`);
    this.name = 'NoModelsAvailableError';
  }
}

export async function executeGemini(id: number, prompt: string, type: string): Promise<void> {
  while (true) {
    const selectedModel = MODELS.find((m) => (modelCooldowns.get(m) || 0) < Date.now());

    if (!selectedModel) {
      const earliestCooldown = Math.min(...Array.from(modelCooldowns.values()));
      const waitTime = Math.max(earliestCooldown - Date.now(), 1000);
      throw new NoModelsAvailableError(waitTime);
    }

    // Session Logging
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionDir = path.join('.anton', 'sessions', String(id));
    await mkdir(sessionDir, { recursive: true });

    const sessionFilePath = path.join(sessionDir, `${type}-${timestamp}.txt`);
    const logStream = createWriteStream(sessionFilePath);

    const subprocess = execa('gemini', [
      '-p',
      prompt,
      '--sandbox',
      'true',
      '--approval-mode',
      'yolo',
      '--model',
      selectedModel,
    ]);

    // Hook into the stream
    subprocess.stdout?.on('data', (chunk) => {
      const data = chunk.toString();
      logStream.write(data);
    });

    // Hook into the stream
    subprocess.stderr?.on('data', (chunk) => {
      const data = chunk.toString();
      logStream.write(data);
    });

    try {
      await subprocess;
      return;
    } catch (error: any) {
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
