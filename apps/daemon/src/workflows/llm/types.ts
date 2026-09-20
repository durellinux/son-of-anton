export type LlmProvider = 'gemini' | 'antigravity';

export type LlmExecutor = (id: number, prompt: string, type: string) => Promise<string>;

export class NoModelsAvailableError extends Error {
  constructor(public waitTimeMs: number) {
    super(`No models available. Wait time: ${waitTimeMs}ms`);
    this.name = 'NoModelsAvailableError';
  }
}
