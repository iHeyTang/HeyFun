import { ToolResult } from '@/agents/core/tools/tool-definition';
import { CanvasToolboxContext } from '../context';
import { getCanvasState } from '../utils';

const executor = async (args: any, context: CanvasToolboxContext): Promise<ToolResult> => {
  try {
    const canvasState = getCanvasState(context);
    const nodeList = (canvasState.nodes || [])
      .map((node: any, index: number) => `${index + 1}. ${node.data?.label || 'Unnamed'} (ID: ${node.id}, 类型: ${node.type})`)
      .join('\n');

    return {
      success: true,
      message: `📊 画布状态：\n📦 节点数量: ${canvasState.nodes?.length || 0}\n🔗 连接数量: ${canvasState.edges?.length || 0}\n\n📌 节点列表：\n${nodeList || '(无节点)'}`,
      data: {
        nodes: canvasState.nodes || [],
        edges: canvasState.edges || [],
        nodeCount: canvasState.nodes?.length || 0,
        edgeCount: canvasState.edges?.length || 0,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

export const getCanvasStateTool = {
  toolName: 'get_canvas_state',
  executor,
};
