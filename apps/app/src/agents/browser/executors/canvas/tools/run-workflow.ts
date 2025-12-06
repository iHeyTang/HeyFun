/**
 * 运行工作流工具
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';

export const runWorkflowTool = createTool(
  {
    type: 'function',
    function: {
      name: 'run_canvas_workflow',
      description: '执行画布上的工作流',
      parameters: {
        type: 'object',
        properties: {
          nodeIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      if (!context.canvasRef?.current) {
        return { success: false, error: 'Canvas reference not available' };
      }

      const result = await context.canvasRef.current.run();

      if (!result.success) {
        const errorMessages = result.errors.map((e: { nodeId: string; error: string }) => `${e.nodeId}: ${e.error}`).join('; ');
        return {
          success: false,
          error: `Workflow execution failed: ${errorMessages}`,
          data: { errors: result.errors },
        };
      }

      return {
        success: true,
        message: `✅ 工作流执行成功`,
        data: { nodeStates: Object.fromEntries(result.nodeStates) },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);
