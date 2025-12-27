import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 检索提示词片段参数 Schema
 */
export const retrievePromptFragmentsParamsSchema = z.object({
  userMessage: z.string().describe('用户的消息内容，用于检索相关的提示词片段'),
  intent: z
    .object({
      primaryGoal: z.string().optional(),
      taskType: z.string().optional(),
      complexity: z.enum(['simple', 'medium', 'complex']).optional(),
    })
    .optional()
    .describe('可选的意图信息，帮助更精准地检索相关片段'),
  maxFragments: z.number().int().min(1).max(10).default(5).describe('最多返回的片段数量（1-10）'),
});

export type RetrievePromptFragmentsParams = z.infer<typeof retrievePromptFragmentsParamsSchema>;

export const retrievePromptFragmentsSchema: ToolDefinition = {
  name: 'retrieve_prompt_fragments',
  description: '根据用户消息和意图检索相关的提示词片段。这些片段包含了针对特定任务类型或场景的能力说明和指导，帮助你更好地理解任务、扮演相应角色、遵循特定规范。在开始处理用户请求前，如果任务需要特定能力，应该调用此工具来获取相关的提示词片段。你可以将你在思考阶段分析的意图信息（primaryGoal、taskType、complexity）作为可选参数传递，以帮助工具更精准地检索相关片段。',
  parameters: zodToJsonSchema(retrievePromptFragmentsParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'agent',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      fragments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            content: { type: 'string' },
          },
        },
        description: '检索到的提示词片段列表',
      },
      fragmentIds: { type: 'array', items: { type: 'string' }, description: '片段ID列表' },
      confidence: { type: 'number', description: '检索置信度 (0-1)' },
      reasons: { type: 'array', items: { type: 'string' }, description: '检索原因说明' },
    },
  },
};

