/**
 * 批量添加节点工具
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';
import { getCanvasState, updateCanvasState, generateNodeId, buildNodeActionData } from '../helpers';

export const addNodesBatchTool = createTool(
  {
    type: 'function',
    function: {
      name: 'add_canvas_nodes_batch',
      description: '批量添加多个节点到画布',
      parameters: {
        type: 'object',
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nodeType: { type: 'string', enum: ['text', 'image', 'video', 'audio', 'music', 'group'] },
                label: { type: 'string' },
                description: { type: 'string' },
                position: { type: 'object' },
                parentId: { type: 'string' },
                auto: { type: 'boolean' },
                data: {
                  type: 'object',
                  description:
                    '节点特定数据。根据nodeType传递不同字段：text节点传text；image/video/music节点传prompt、model、size等；audio节点传text、voiceId、model',
                  properties: {
                    text: { type: 'string', description: '文本内容（text和audio节点使用）' },
                    prompt: { type: 'string', description: '生成提示词（image/video/music节点使用）' },
                    model: { type: 'string', description: '模型名称' },
                    size: { type: 'string', description: '尺寸（image节点，如1024x1024）' },
                    quality: { type: 'string', description: '质量（image节点）' },
                    duration: { type: 'number', description: '时长（video/music节点，单位秒）' },
                    voiceId: { type: 'string', description: '语音ID（audio节点）' },
                  },
                },
              },
              required: ['nodeType', 'label'],
            },
          },
        },
        required: ['nodes'],
      },
    },
  },
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const { nodes } = args;
      const canvasState = getCanvasState(context);
      const createdNodes: any[] = [];

      for (const nodeSpec of nodes) {
        const newNode = {
          id: generateNodeId(),
          type: nodeSpec.nodeType,
          position: nodeSpec.position || { x: Math.random() * 400, y: Math.random() * 400 },
          ...(nodeSpec.parentId && { parentId: nodeSpec.parentId }),
          data: {
            label: nodeSpec.label,
            description: nodeSpec.description || '',
            auto: nodeSpec.auto !== false,
            ...buildNodeActionData(nodeSpec.nodeType, nodeSpec.data),
          },
        };
        canvasState.nodes.push(newNode);
        createdNodes.push({ id: newNode.id, label: newNode.data.label });
      }

      updateCanvasState(context, canvasState);

      return {
        success: true,
        message: `✅ 批量创建了 ${createdNodes.length} 个节点`,
        data: { createdNodes },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);
