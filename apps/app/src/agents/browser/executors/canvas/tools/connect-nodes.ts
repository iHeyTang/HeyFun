/**
 * 连接节点工具
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';
import { getCanvasState, updateCanvasState, generateEdgeId } from '../helpers';

export const connectNodesTool = createTool(
  {
    type: 'function',
    function: {
      name: 'connect_canvas_nodes',
      description: '连接两个画布节点，创建数据流关系',
      parameters: {
        type: 'object',
        properties: {
          sourceNodeId: { type: 'string', description: '源节点ID' },
          targetNodeId: { type: 'string', description: '目标节点ID' },
          sourceHandle: { type: 'string', description: '源节点连接点，默认output' },
          targetHandle: { type: 'string', description: '目标节点连接点，默认input' },
        },
        required: ['sourceNodeId', 'targetNodeId'],
      },
    },
  },
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const { sourceNodeId, targetNodeId, sourceHandle, targetHandle } = args;
      const canvasState = getCanvasState(context);

      const sourceNode = canvasState.nodes.find((node: any) => node.id === sourceNodeId);
      const targetNode = canvasState.nodes.find((node: any) => node.id === targetNodeId);

      if (!sourceNode) return { success: false, error: `Source node not found: ${sourceNodeId}` };
      if (!targetNode) return { success: false, error: `Target node not found: ${targetNodeId}` };

      // 检查是否已存在连接
      const existingEdge = canvasState.edges.find(
        (edge: any) =>
          edge.source === sourceNodeId &&
          edge.target === targetNodeId &&
          edge.sourceHandle === (sourceHandle || 'output') &&
          edge.targetHandle === (targetHandle || 'input'),
      );

      if (existingEdge) {
        return { success: false, error: `Edge already exists between ${sourceNodeId} and ${targetNodeId}` };
      }

      const newEdge = {
        id: generateEdgeId(),
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: sourceHandle || 'output',
        targetHandle: targetHandle || 'input',
        type: 'default',
      };

      canvasState.edges.push(newEdge);
      updateCanvasState(context, canvasState);

      return {
        success: true,
        message: `✅ 已连接: ${sourceNode.data?.label} → ${targetNode.data?.label}`,
        data: { edgeId: newEdge.id, sourceNodeId, targetNodeId },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

