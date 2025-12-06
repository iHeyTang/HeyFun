/**
 * 断开节点连接工具
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';
import { getCanvasState, updateCanvasState } from '../helpers';

export const disconnectNodesTool = createTool(
  {
    type: 'function',
    function: {
      name: 'disconnect_canvas_nodes',
      description: '移除两个节点之间的连接',
      parameters: {
        type: 'object',
        properties: {
          sourceNodeId: { type: 'string' },
          targetNodeId: { type: 'string' },
        },
        required: ['sourceNodeId', 'targetNodeId'],
      },
    },
  },
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const { sourceNodeId, targetNodeId } = args;
      const canvasState = getCanvasState(context);

      const edgesToRemove = canvasState.edges.filter((edge: any) => edge.source === sourceNodeId && edge.target === targetNodeId);

      if (edgesToRemove.length === 0) {
        return { success: false, error: `No edge found between ${sourceNodeId} and ${targetNodeId}` };
      }

      canvasState.edges = canvasState.edges.filter((edge: any) => !(edge.source === sourceNodeId && edge.target === targetNodeId));

      updateCanvasState(context, canvasState);

      return {
        success: true,
        message: `✅ 已移除 ${edgesToRemove.length} 个连接`,
        data: { removedCount: edgesToRemove.length },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);
