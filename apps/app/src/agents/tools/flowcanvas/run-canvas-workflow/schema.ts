import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 执行画布工作流的参数 Schema
 */
export const runCanvasWorkflowParamsSchema = z.object({
  projectId: z.string().describe('FlowCanvas项目ID'),
});

export type RunCanvasWorkflowParams = z.infer<typeof runCanvasWorkflowParamsSchema>;

export const runCanvasWorkflowSchema: ToolDefinition = {
  name: 'run_canvas_workflow',
  description: '执行画布工作流，运行所有节点。注意：工作流执行需要在前端环境中进行，此工具会返回工作流状态信息。',
  parameters: zodToJsonSchema(runCanvasWorkflowParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
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

