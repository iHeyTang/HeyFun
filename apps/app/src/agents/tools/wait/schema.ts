import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 等待工具的参数 Schema
 */
export const waitParamsSchema = z
  .object({
    seconds: z.number().min(0).max(60).optional().describe('等待的秒数（可选，与milliseconds二选一）'),
    milliseconds: z.number().min(0).max(60000).optional().describe('等待的毫秒数（可选，与seconds二选一）'),
  })
  .refine(data => data.seconds !== undefined || data.milliseconds !== undefined, {
    message: 'Either seconds or milliseconds must be provided',
  });

export type WaitParams = z.infer<typeof waitParamsSchema>;

export const waitSchema: ToolDefinition = {
  name: 'wait',
  description: '等待指定的时间。用于在异步任务（如AIGC生成）后等待一段时间，然后再查询结果。可以按秒或毫秒指定等待时间。',
  parameters: zodToJsonSchema(waitParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'utility',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      waited: { type: 'number', description: '实际等待的毫秒数' },
      unit: { type: 'string', description: '时间单位：milliseconds' },
      message: { type: 'string', description: '等待完成的消息' },
    },
  },
};

