/**
 * 链式连接节点工具
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';
import { getCanvasState, updateCanvasState, generateEdgeId } from '../helpers';

export const connectNodesChainTool = createTool(
  {
    type: 'function',
    function: {
      name: 'connect_canvas_nodes_chain',
      description: '将多个节点串联连接成链式结构（A→B→C→D）',
      parameters: {
        type: 'object',
        properties: {
          nodeIds: {
            type: 'array',
            description: '要连接的节点ID列表，按顺序排列',
            items: { type: 'string' },
          },
        },
        required: ['nodeIds'],
      },
    },
  },
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const { nodeIds } = args;
      if (nodeIds.length < 2) {
        return { success: false, error: 'At least 2 nodes required for chain connection' };
      }

      const canvasState = getCanvasState(context);
      const createdEdges: string[] = [];

      for (let i = 0; i < nodeIds.length - 1; i++) {
        const sourceNodeId = nodeIds[i];
        const targetNodeId = nodeIds[i + 1];

        const sourceNode = canvasState.nodes.find((node: any) => node.id === sourceNodeId);
        const targetNode = canvasState.nodes.find((node: any) => node.id === targetNodeId);

        if (!sourceNode || !targetNode) continue;

        const newEdge = {
          id: generateEdgeId(),
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle: 'output',
          targetHandle: 'input',
          type: 'default',
        };

        canvasState.edges.push(newEdge);
        createdEdges.push(newEdge.id);
      }

      updateCanvasState(context, canvasState);

      return {
        success: true,
        message: `✅ 已创建链式连接，共 ${createdEdges.length} 个连接`,
        data: { createdEdges },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

