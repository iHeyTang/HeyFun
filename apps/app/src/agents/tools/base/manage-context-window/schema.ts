import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 管理上下文窗口参数 Schema
 */
export const manageContextWindowParamsSchema = z.object({
  action: z
    .enum(['check', 'manage'])
    .default('check')
    .describe('操作类型：check（仅检查并返回建议，不修改消息）、manage（执行管理并返回修改后的消息）'),
  maxMessages: z.number().int().min(1).max(1000).optional().describe('最大消息数量（可选，默认30）'),
  maxTokens: z.number().int().min(1000).max(1000000).optional().describe('最大 token 数量（可选，默认8000）'),
  strategy: z
    .enum(['sliding_window', 'summary_compression', 'hybrid'])
    .optional()
    .describe('管理策略：sliding_window（滑动窗口）、summary_compression（摘要压缩）、hybrid（混合策略）'),
});

export type ManageContextWindowParams = z.infer<typeof manageContextWindowParamsSchema>;

export const manageContextWindowSchema: ToolDefinition = {
  name: 'manage_context_window',
  description:
    '检查和管理对话上下文窗口，确保不超过模型限制。当检测到上下文可能超过限制时，可以使用此工具来管理上下文。工具可以：1) 检查当前上下文状态；2) 返回管理建议；3) 如果需要，执行上下文管理（压缩、截断等）。建议在开始处理任务前，如果上下文较长，先调用此工具检查状态。',
  parameters: zodToJsonSchema(manageContextWindowParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'agent',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      needsManagement: {
        type: 'boolean',
        description: '是否需要管理上下文',
      },
      currentMessageCount: { type: 'number', description: '当前消息数量' },
      currentTokenCount: { type: 'number', description: '当前估算的 token 数量' },
      maxMessages: { type: 'number', description: '最大消息数量限制' },
      maxTokens: { type: 'number', description: '最大 token 数量限制' },
      recommendation: {
        type: 'string',
        description: '管理建议（如果需要管理）',
      },
      managedMessages: {
        type: 'array',
        items: { type: 'object' },
        description: '管理后的消息列表（仅在 action=manage 时返回）',
      },
      summary: { type: 'string', description: '压缩摘要（如果有）' },
      keyPoints: { type: 'array', items: { type: 'string' }, description: '关键信息点（如果有）' },
    },
  },
};
