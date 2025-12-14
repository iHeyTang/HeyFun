import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

/**
 * auto_layout_canvas 工具定义
 */
export const autoLayoutDefinition: ToolDefinition = {
  name: 'auto_layout_canvas',
  description: '自动优化画布布局',
  parameters: {
    type: 'object',
    properties: {
      direction: { type: 'string', enum: ['TB', 'LR'], default: 'LR' },
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
