import { describe, it, expect } from 'vitest';
import { setActiveModel, getActiveModel, getLlmExecutor } from './llm';
import { executeGemini } from './gemini';
import { executeAntigravity } from './antigravity';
import { executeOpenCode } from './opencode';

describe('LLM Provider Selection', () => {
  it('should default active model to antigravity', () => {
    expect(getActiveModel()).toBe('antigravity');
    expect(getLlmExecutor()).toBe(executeAntigravity);
  });

  it('should switch active model to gemini', () => {
    setActiveModel('gemini');
    expect(getActiveModel()).toBe('gemini');
    expect(getLlmExecutor()).toBe(executeGemini);
  });

  it('should switch active model to opencode', () => {
    setActiveModel('opencode');
    expect(getActiveModel()).toBe('opencode');
    expect(getLlmExecutor()).toBe(executeOpenCode);
  });
});
