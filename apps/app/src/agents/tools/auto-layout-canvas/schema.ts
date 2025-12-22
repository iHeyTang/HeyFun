import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const autoLayoutCanvasSchema: ToolDefinition = {
  name: 'auto_layout_canvas',
  description: '自动优化画布布局，重新排列节点位置',
  parameters: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'FlowCanvas项目ID',
      },
      direction: {
        type: 'string',
        enum: ['TB', 'LR'],
        description: '布局方向：TB（从上到下）或 LR（从左到右）',
        default: 'LR',
      },
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

