import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const runCanvasWorkflowSchema: ToolDefinition = {
  name: 'run_canvas_workflow',
  description: '执行画布工作流，运行所有节点。注意：工作流执行需要在前端环境中进行，此工具会返回工作流状态信息。',
  parameters: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'FlowCanvas项目ID',
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

