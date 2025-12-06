/**
 * 断开节点所有连接工具
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';
import { getCanvasState, updateCanvasState } from '../helpers';

export const disconnectNodeAllTool = createTool(
  {
    type: 'function',
    function: {
      name: 'disconnect_node_all',
      description: '移除指定节点的所有连接',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
          direction: {
            type: 'string',
            enum: ['input', 'output', 'all'],
            default: 'all',
          },
        },
        required: ['nodeId'],
      },
    },
  },
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const { nodeId, direction = 'all' } = args;
      const canvasState = getCanvasState(context);

      let removedCount = 0;

      if (direction === 'input' || direction === 'all') {
        const inputEdges = canvasState.edges.filter((edge: any) => edge.target === nodeId);
        removedCount += inputEdges.length;
        canvasState.edges = canvasState.edges.filter((edge: any) => edge.target !== nodeId);
      }

      if (direction === 'output' || direction === 'all') {
        const outputEdges = canvasState.edges.filter((edge: any) => edge.source === nodeId);
        removedCount += outputEdges.length;
        canvasState.edges = canvasState.edges.filter((edge: any) => edge.source !== nodeId);
      }

      updateCanvasState(context, canvasState);

      return {
        success: true,
        message: `✅ 已移除节点的 ${removedCount} 个连接`,
        data: { removedCount, direction },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);
