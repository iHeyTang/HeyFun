import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const runWorkflowDefinition: ToolDefinition = {
  name: 'run_canvas_workflow',
  description: '执行画布工作流，运行所有节点',
  parameters: {
    type: 'object',
    properties: {},
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
