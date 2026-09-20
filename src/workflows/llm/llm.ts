import { LlmProvider, LlmExecutor } from './types';
import { executeGemini } from './gemini';
import { executeAntigravity } from './antigravity';
import { executeOpenCode } from './opencode';

let activeModel: LlmProvider = 'antigravity';

export function setActiveModel(model: LlmProvider): void {
  activeModel = model;
}

export function getActiveModel(): LlmProvider {
  return activeModel;
}

export function getLlmExecutor(): LlmExecutor {
  switch (activeModel) {
    case 'gemini':
      return executeGemini;
    case 'antigravity':
      return executeAntigravity;
    case 'opencode':
      return executeOpenCode;
    default:
      throw new Error(`Unsupported LLM provider: ${activeModel}`);
  }
}
