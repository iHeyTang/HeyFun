/**
 * 添加单个节点工具
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';
import { getCanvasState, updateCanvasState, generateNodeId, buildNodeActionData } from '../helpers';

export const addNodeTool = createTool(
  {
    type: 'function',
    function: {
      name: 'add_canvas_node',
      description: '在画布上添加单个节点。支持：text（文本）、image（图像）、video（视频）、audio（音频）、music（音乐）、group（分组容器）',
      parameters: {
        type: 'object',
        properties: {
          nodeType: {
            type: 'string',
            enum: ['text', 'image', 'video', 'audio', 'music', 'group'],
          },
          label: { type: 'string', description: '节点标签/标题' },
          description: { type: 'string', description: '节点描述' },
          position: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' } },
          },
          parentId: { type: 'string', description: '父节点ID，用于将节点添加到group内' },
          auto: { type: 'boolean', description: '是否自动执行，默认true' },
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
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const { nodeType, label, description, position, parentId, auto, data } = args;
      const canvasState = getCanvasState(context);

      const newNode = {
        id: generateNodeId(),
        type: nodeType,
        position: position || { x: Math.random() * 400, y: Math.random() * 400 },
        ...(parentId && { parentId }),
        data: {
          label,
          description: description || '',
          auto: auto !== false,
          ...buildNodeActionData(nodeType, data),
        },
      };

      canvasState.nodes.push(newNode);
      updateCanvasState(context, canvasState);

      return {
        success: true,
        message: `✅ 节点已创建！\n📌 节点ID: ${newNode.id}\n📝 标签: ${label}\n🎯 类型: ${nodeType}`,
        data: { nodeId: newNode.id, nodeType, label },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);
