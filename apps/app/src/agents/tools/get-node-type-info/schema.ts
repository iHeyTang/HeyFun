import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const getNodeTypeInfoSchema: ToolDefinition = {
  name: 'get_node_type_info',
  description: '获取指定节点类型的详细信息，包括可用模型和参数配置',
  parameters: {
    type: 'object',
    properties: {
      nodeType: {
        type: 'string',
        enum: ['text', 'image', 'video', 'audio', 'music', 'group'],
        description: '节点类型',
      },
    },
    required: ['nodeType'],
  },
  runtime: ToolRuntime.SERVER,
  category: 'canvas',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
};

