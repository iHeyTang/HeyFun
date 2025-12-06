/**
 * 批量连接节点工具
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';
import { getCanvasState, updateCanvasState, generateEdgeId } from '../helpers';

export const connectNodesBatchTool = createTool(
  {
    type: 'function',
    function: {
      name: 'connect_canvas_nodes_batch',
      description: '批量创建节点连接',
      parameters: {
        type: 'object',
        properties: {
          connections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sourceNodeId: { type: 'string' },
                targetNodeId: { type: 'string' },
                sourceHandle: { type: 'string' },
                targetHandle: { type: 'string' },
              },
              required: ['sourceNodeId', 'targetNodeId'],
            },
          },
        },
        required: ['connections'],
      },
    },
  },
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const { connections } = args;
      const canvasState = getCanvasState(context);
      const createdEdges: any[] = [];

      for (const conn of connections) {
        const { sourceNodeId, targetNodeId, sourceHandle, targetHandle } = conn;

        // 验证节点存在
        const sourceNode = canvasState.nodes.find((node: any) => node.id === sourceNodeId);
        const targetNode = canvasState.nodes.find((node: any) => node.id === targetNodeId);

        if (!sourceNode || !targetNode) continue;

        // 检查重复
        const exists = canvasState.edges.some(
          (edge: any) =>
            edge.source === sourceNodeId &&
            edge.target === targetNodeId &&
            edge.sourceHandle === (sourceHandle || 'output') &&
            edge.targetHandle === (targetHandle || 'input'),
        );

        if (exists) continue;

        const newEdge = {
          id: generateEdgeId(),
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle: sourceHandle || 'output',
          targetHandle: targetHandle || 'input',
          type: 'default',
        };

        canvasState.edges.push(newEdge);
        createdEdges.push(newEdge.id);
      }

      updateCanvasState(context, canvasState);

      return {
        success: true,
        message: `✅ 批量创建了 ${createdEdges.length} 个连接`,
        data: { createdEdges },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);
