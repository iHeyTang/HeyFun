/**
 * 删除节点工具
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';
import { getCanvasState, updateCanvasState } from '../helpers';

export const deleteNodeTool = createTool(
  {
    type: 'function',
    function: {
      name: 'delete_canvas_node',
      description: '从画布上删除单个节点及其相关连接',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: '要删除的节点ID' },
        },
        required: ['nodeId'],
      },
    },
  },
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const { nodeId } = args;
      const canvasState = getCanvasState(context);

      const nodeIndex = canvasState.nodes.findIndex((node: any) => node.id === nodeId);
      if (nodeIndex === -1) {
        return { success: false, error: `Node not found: ${nodeId}` };
      }

      const deletedNode = canvasState.nodes[nodeIndex];
      canvasState.nodes.splice(nodeIndex, 1);

      // 删除相关连接
      const connectedEdges = canvasState.edges.filter((edge: any) => edge.source === nodeId || edge.target === nodeId);
      canvasState.edges = canvasState.edges.filter((edge: any) => edge.source !== nodeId && edge.target !== nodeId);

      updateCanvasState(context, canvasState);

      return {
        success: true,
        message: `✅ 已删除节点: ${deletedNode.data?.label || nodeId} 及 ${connectedEdges.length} 个连接`,
        data: { nodeId, deletedEdgesCount: connectedEdges.length },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

