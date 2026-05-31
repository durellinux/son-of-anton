import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { execa } from 'execa';

export async function executeGemini(id: number, prompt: string, type: string) {
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
  } finally {
    logStream.end();
  }
}
