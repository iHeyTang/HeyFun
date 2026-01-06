import { completeParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';

export const completeExecutor = definitionToolExecutor(completeParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId || 'complete'}`, async () => {
    return {
      success: true,
      data: null,
    };
  });
});
