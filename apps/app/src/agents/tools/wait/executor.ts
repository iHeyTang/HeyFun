import { ToolResult } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';

export async function waitExecutor(args: any, context: ToolContext): Promise<ToolResult> {
  const { stepName, sleepSeconds, waitTimeMs } = await context.workflow.run(`wait-${context.toolCallId}`, async () => {
    const { seconds = 1, milliseconds } = args;

    let waitTimeMs = 0;

    if (milliseconds !== undefined && typeof milliseconds === 'number') {
      waitTimeMs = Math.max(0, Math.min(milliseconds, 60000)); // 限制在0-60秒之间
    } else if (seconds !== undefined && typeof seconds === 'number') {
      waitTimeMs = Math.max(0, Math.min(seconds * 1000, 60000)); // 限制在0-60秒之间
    } else {
      return {
        success: false,
        error: 'Either seconds or milliseconds must be provided and must be a number',
      };
    }

    // 使用 workflow 的 sleep 方法等待指定时间
    const sleepSeconds = Math.ceil(waitTimeMs / 1000);
    const stepName = `wait-${context.toolCallId}`;
    return { stepName, sleepSeconds, waitTimeMs };
  });

  if (!stepName || !sleepSeconds || !waitTimeMs) {
    return {
      success: false,
      error: 'Failed to wait',
    };
  }

  await context.workflow.sleep(stepName, `${BigInt(sleepSeconds)}s`);

  return {
    success: true,
    data: {
      waited: waitTimeMs,
      unit: 'milliseconds',
      message: `Waited for ${waitTimeMs}ms (${(waitTimeMs / 1000).toFixed(2)}s)`,
    },
  };
}

