import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 检索上下文参数 Schema
 */
export const retrieveContextParamsSchema = z.object({
  maxSnapshots: z.number().int().min(1).max(10).optional().describe('最多检索的快照数量（默认 3）'),
});

export type RetrieveContextParams = z.infer<typeof retrieveContextParamsSchema>;

export const retrieveContextSchema: ToolDefinition = {
  name: 'retrieve_context',
  description: '从数据库检索相关的上下文快照，整合长期记忆。当需要访问历史对话信息、用户偏好或重要决策时，可以使用此工具。建议在会话开始时调用此工具来加载历史上下文。',
  displayName: {
    en: 'Retrieve Context',
    'zh-CN': '检索上下文',
    'zh-TW': '檢索上下文',
    ja: 'コンテキストを取得',
    ko: '컨텍스트 검색',
  },
  parameters: zodToJsonSchema(retrieveContextParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'agent',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      retrieved: { type: 'boolean', description: '是否检索到相关上下文' },
      snapshotCount: { type: 'number', description: '检索到的快照数量' },
      integratedMessages: { type: 'number', description: '整合到上下文的消息数量' },
      keyPoints: { type: 'array', items: { type: 'string' }, description: '检索到的关键信息点' },
      preservedContext: { type: 'string', description: '保留的上下文信息' },
    },
  },
};

