import * as restate from '@restatedev/restate-sdk';
import { executeGemini, NoModelsAvailableError } from '../gemini';

export async function geminiLoop(
  ctx: restate.WorkflowContext,
  runNamePrefix: string,
  id: number,
  prompt: string,
  type: string,
) {
  let attempt = 1;
  while (true) {
    const result = await ctx.run(`${runNamePrefix}-attempt-${attempt}`, async () => {
      try {
        await executeGemini(id, prompt, type);
        return { success: true };
      } catch (error: any) {
        if (error instanceof NoModelsAvailableError || error.name === 'NoModelsAvailableError') {
          return { success: false, waitTimeMs: error.waitTimeMs };
        }
        throw error;
      }
    });

    if (result.success) {
      break;
    }

    if (result.waitTimeMs) {
      await ctx.sleep(result.waitTimeMs);
      attempt++;
    }
  }
}
