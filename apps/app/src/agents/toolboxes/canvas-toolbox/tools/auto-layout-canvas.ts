import { CanvasToolboxContext } from '../context';
import { ToolResult } from '@/agents/core/tools/tool-definition';

const executor = async (args: any, context: CanvasToolboxContext): Promise<ToolResult> => {
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
};

export const autoLayoutCanvasTool = {
  toolName: 'auto_layout_canvas',
  executor,
};
