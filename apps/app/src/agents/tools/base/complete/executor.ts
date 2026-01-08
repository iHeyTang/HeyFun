import { completeParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';

export const completeExecutor = definitionToolExecutor(completeParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId || 'complete'}`, async () => {
    // 设置完结状态为 'complete'
    if (context.completion) {
      context.completion.setCompletion('complete', 'complete');
    }

    return {
      success: true,
      data: null,
    };
  });
});
