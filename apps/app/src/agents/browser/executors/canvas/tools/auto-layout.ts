/**
 * 自动布局工具
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';

export const autoLayoutTool = createTool(
  {
    type: 'function',
    function: {
      name: 'auto_layout_canvas',
      description: '自动优化画布布局',
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['TB', 'LR'], default: 'LR' },
        },
      },
    },
  },
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const { direction = 'TB' } = args;
      if (!context.canvasRef?.current) {
        return { success: false, error: 'Canvas reference not available' };
      }
      context.canvasRef.current.autoLayout(direction);
      return {
        success: true,
        message: `✅ 已应用 ${direction} 布局`,
        data: { direction },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);
