import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const getCanvasCapabilitiesSchema: ToolDefinition = {
  name: 'get_canvas_capabilities',
  description: '获取画布的能力信息，包括支持的节点类型、可用模型、参数配置等。在创建节点前应该先调用此工具了解画布的实际配置',
  parameters: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'FlowCanvas项目ID（可选）',
      },
    },
    required: [],
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

