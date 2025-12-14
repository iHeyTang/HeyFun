import { ToolResult } from '@/agents/core/tools/tool-definition';
import { GeneralToolboxContext } from '../context';

const executor = async (args: any, context: GeneralToolboxContext): Promise<ToolResult> => {
  try {
    const { seconds = 1, milliseconds } = args;

    let waitTime = 0;

    if (milliseconds !== undefined && typeof milliseconds === 'number') {
      waitTime = Math.max(0, Math.min(milliseconds, 60000)); // 限制在0-60秒之间
    } else if (seconds !== undefined && typeof seconds === 'number') {
      waitTime = Math.max(0, Math.min(seconds * 1000, 60000)); // 限制在0-60秒之间
    } else {
      return {
        success: false,
        error: 'Either seconds or milliseconds must be provided and must be a number',
      };
    }

    // 等待指定时间
    await new Promise(resolve => setTimeout(resolve, waitTime));

    return {
      success: true,
      data: {
        waited: waitTime,
        unit: 'milliseconds',
        message: `Waited for ${waitTime}ms (${(waitTime / 1000).toFixed(2)}s)`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

export const waitTool = {
  toolName: 'wait',
  executor,
};

