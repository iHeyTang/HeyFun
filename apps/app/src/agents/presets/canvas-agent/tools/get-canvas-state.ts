import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const getCanvasStateDefinition: ToolDefinition = {
  name: 'get_canvas_state',
  description: '获取当前画布的完整状态',
  parameters: {
    type: 'object',
    properties: {
      includeNodeDetails: { type: 'boolean', default: true },
    },
  },
  runtime: ToolRuntime.CLIENT,
  category: 'canvas',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
};
