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
  updateSystemPrompt: z
    .boolean()
    .default(false)
    .describe('是否在检索到片段后更新动态系统提示词。如果为 true，检索到的片段会被用于生成新的动态系统提示词并更新到当前会话'),
  retrievalReason: z
    .string()
    .optional()
    .describe('检索原因说明，用于记录为什么需要检索这些片段（如"发现任务涉及签证信息，需要检索签证相关指导"）'),
});

export type RetrievePromptFragmentsParams = z.infer<typeof retrievePromptFragmentsParamsSchema>;

export const retrievePromptFragmentsSchema: ToolDefinition = {
  name: 'retrieve_prompt_fragments',
  description: '根据用户消息和意图检索相关的提示词片段。这些片段包含了针对特定任务类型或场景的能力说明和指导，帮助你更好地理解任务、扮演相应角色、遵循特定规范。在开始处理用户请求前，如果任务需要特定能力，应该调用此工具来获取相关的提示词片段。你可以将你在思考阶段分析的意图信息（primaryGoal、taskType、complexity）作为可选参数传递，以帮助工具更精准地检索相关片段。',
  displayName: {
    en: 'Retrieve Prompt Fragments',
    'zh-CN': '检索提示词片段',
    'zh-TW': '檢索提示詞片段',
    ja: 'プロンプトフラグメントを取得',
    ko: '프롬프트 조각 검색',
  },
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
      retrievalReason: {
        type: 'string',
        description: '检索原因说明，记录为什么需要检索这些片段',
      },
      dynamicSystemPrompt: {
        type: 'string',
        description: '如果 updateSystemPrompt 为 true，返回生成的动态系统提示词片段（已自动应用到当前会话）',
      },
    },
  },
};

