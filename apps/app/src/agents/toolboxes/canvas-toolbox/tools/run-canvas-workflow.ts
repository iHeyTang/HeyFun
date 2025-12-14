import { CanvasToolboxContext } from '../context';
import { ToolResult } from '@/agents/core/tools/tool-definition';

const executor = async (args: any, context: CanvasToolboxContext): Promise<ToolResult> => {
  try {
    if (!context.canvasRef?.current) {
      return { success: false, error: 'Canvas reference not available' };
    }

    // 执行工作流
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
};

export const runCanvasWorkflowTool = {
  toolName: 'run_canvas_workflow',
  executor,
};
