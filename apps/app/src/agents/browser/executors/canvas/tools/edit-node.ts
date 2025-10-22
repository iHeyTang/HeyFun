/**
 * 编辑节点工具
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';
import { getCanvasState, updateCanvasState } from '../helpers';

export const editNodeTool = createTool(
  {
    type: 'function',
    function: {
      name: 'edit_canvas_node',
      description: '编辑画布上的现有节点',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: '要编辑的节点ID' },
          updates: {
            type: 'object',
            description: '要更新的字段',
            properties: {
              label: { type: 'string', description: '节点标签' },
              description: { type: 'string', description: '节点描述' },
              auto: { type: 'boolean', description: '是否自动执行' },
              position: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                },
                description: '节点位置',
              },
              actionData: {
                type: 'object',
                description: '节点动作数据',
                properties: {
                  text: { type: 'string', description: '文本内容' },
                  prompt: { type: 'string', description: '生成提示词' },
                  model: { type: 'string', description: '模型名称' },
                  size: { type: 'string', description: '尺寸' },
                  quality: { type: 'string', description: '质量' },
                  duration: { type: 'number', description: '时长（秒）' },
                  voiceId: { type: 'string', description: '语音ID' },
                },
              },
            },
          },
        },
        required: ['nodeId', 'updates'],
      },
    },
  },
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const { nodeId, updates } = args;
      const canvasState = getCanvasState(context);

      const nodeIndex = canvasState.nodes.findIndex((node: any) => node.id === nodeId);
      if (nodeIndex === -1) {
        return { success: false, error: `Node not found: ${nodeId}` };
      }

      const oldNode = canvasState.nodes[nodeIndex];
      const updatedNode = {
        ...oldNode,
        data: {
          ...oldNode.data,
          ...(updates.label && { label: updates.label }),
          ...(updates.description && { description: updates.description }),
          ...(updates.auto !== undefined && { auto: updates.auto }),
          ...(updates.actionData && {
            actionData: { ...oldNode.data.actionData, ...updates.actionData },
          }),
        },
        ...(updates.position && { position: updates.position }),
      };

      canvasState.nodes[nodeIndex] = updatedNode;
      updateCanvasState(context, canvasState);

      return {
        success: true,
        message: `✅ 已更新节点: ${nodeId}`,
        data: { nodeId, updates },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);
