import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { waitParamsSchema } from './schema';

export const waitExecutor = definitionToolExecutor(waitParamsSchema, async (args, context) => {
  const { sleepSeconds, waitTimeMs } = await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
    const { seconds, milliseconds } = args;

    let waitTimeMs = 0;

    if (milliseconds !== undefined) {
      waitTimeMs = Math.max(0, Math.min(milliseconds, 60000)); // 限制在0-60秒之间
    } else if (seconds !== undefined) {
      waitTimeMs = Math.max(0, Math.min(seconds * 1000, 60000)); // 限制在0-60秒之间
    } else {
      return {
        success: false,
        error: 'Either seconds or milliseconds must be provided',
      };
    }

    // 使用 workflow 的 sleep 方法等待指定时间
    const sleepSeconds = Math.ceil(waitTimeMs / 1000);
    return { sleepSeconds, waitTimeMs };
  });

  if (!sleepSeconds || !waitTimeMs) {
    return {
      success: false,
      error: 'Failed to wait',
    };
  }

  // sleep 需要使用不同的 step name
  await context.workflow.sleep(`toolcall-${context.toolCallId}-sleep`, `${BigInt(sleepSeconds)}s`);

  return {
    success: true,
    data: {
      waited: waitTimeMs,
      unit: 'milliseconds',
      message: `Waited for ${waitTimeMs}ms (${(waitTimeMs / 1000).toFixed(2)}s)`,
    },
  };
});
