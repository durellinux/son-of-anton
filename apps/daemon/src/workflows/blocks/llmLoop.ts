import * as restate from '@restatedev/restate-sdk';
import { getLlmExecutor, NoModelsAvailableError } from '../llm';

export async function llmLoop(
  ctx: restate.WorkflowContext,
  runNamePrefix: string,
  id: number,
  prompt: string,
  type: string,
): Promise<string> {
  let attempt = 1;
  while (true) {
    const result = await ctx.run(`${runNamePrefix}-attempt-${attempt}`, async () => {
      try {
        const executeLlm = getLlmExecutor();
        const output = await executeLlm(id, prompt, type);
        return { success: true, output };
      } catch (error: any) {
        if (error instanceof NoModelsAvailableError || error.name === 'NoModelsAvailableError') {
          return { success: false, waitTimeMs: error.waitTimeMs };
        }
        throw error;
      }
    });

    if (result.success) {
      return result.output!;
    }

    if (result.waitTimeMs) {
      await ctx.sleep(result.waitTimeMs);
      attempt++;
    }
  }
}
