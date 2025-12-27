import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 压缩上下文参数 Schema
 */
export const compressContextParamsSchema = z.object({
  threshold: z.number().int().min(1000).max(1000000).optional().describe('压缩阈值（token 数量，默认 100000）'),
});

export type CompressContextParams = z.infer<typeof compressContextParamsSchema>;

export const compressContextSchema: ToolDefinition = {
  name: 'compress_context',
  description: '当上下文过长（超过 100k tokens）时，压缩对话内容，提取关键信息。此工具会保留系统消息和最近的消息，对历史消息进行摘要压缩。建议在上下文超过 100k tokens 时使用此工具。',
  parameters: zodToJsonSchema(compressContextParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'agent',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      compressed: { type: 'boolean', description: '是否进行了压缩' },
      originalLength: { type: 'number', description: '原始消息数量' },
      compressedLength: { type: 'number', description: '压缩后消息数量' },
      summary: { type: 'string', description: '压缩摘要' },
      keyPoints: { type: 'array', items: { type: 'string' }, description: '关键信息点' },
      compressedMessages: {
        type: 'array',
        items: { type: 'object' },
        description: '压缩后的消息列表',
      },
    },
  },
};

