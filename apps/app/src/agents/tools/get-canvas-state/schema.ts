import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const getCanvasStateSchema: ToolDefinition = {
  name: 'get_canvas_state',
  description: '获取指定FlowCanvas项目的完整状态',
  parameters: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'FlowCanvas项目ID',
      },
      includeNodeDetails: { type: 'boolean', default: true },
    },
    required: ['projectId'],
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

