import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 构建系统提示词参数 Schema
 */
export const buildSystemPromptParamsSchema = z.object({
  userMessage: z.string().describe('用户的消息内容，用于检索相关的提示词片段'),
  intent: z
    .object({
      primaryGoal: z.string().optional(),
      taskType: z.string().optional(),
      complexity: z.enum(['simple', 'medium', 'complex']).optional(),
    })
    .optional()
    .describe('可选的意图信息，帮助更精准地检索相关片段并构建系统提示词'),
  maxFragments: z.number().int().min(1).max(10).default(5).describe('最多使用的片段数量（1-10）'),
  basePrompt: z.string().optional().describe('可选的基础系统提示词，如果提供，将在此基础上构建；如果不提供，将使用默认的基础提示词'),
});

export type BuildSystemPromptParams = z.infer<typeof buildSystemPromptParamsSchema>;

export const buildSystemPromptSchema: ToolDefinition = {
  name: 'build_system_prompt',
  description:
    '【重要：这是处理新任务的第一步】根据用户消息和意图，检索相关的提示词片段并使用 AI 生成针对性的动态系统提示词片段。这个工具会：1) 从向量库检索与任务相关的提示词片段；2) 使用 LLM 根据检索到的片段和用户意图重新生成针对性的系统提示词片段（不是简单拼接）；3) 自动将生成的提示词应用到当前会话。调用此工具后，系统会自动将生成的动态片段添加到基础系统提示词后面，帮助你更好地理解任务、扮演相应角色、遵循特定规范。**在开始处理任何新任务前，必须先调用此工具来构建合适的动态系统提示词。**调用时，传递 userMessage（必填）和 intent（可选但推荐，包含 primaryGoal、taskType、complexity）。',
  parameters: zodToJsonSchema(buildSystemPromptParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'agent',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      dynamicSystemPrompt: {
        type: 'string',
        description: '动态系统提示词片段内容（不包含基础提示词），已自动应用到当前会话',
      },
      fragmentIds: {
        type: 'array',
        items: { type: 'string' },
        description: '使用的片段ID列表',
      },
      fragments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
          },
        },
        description: '使用的片段信息',
      },
      confidence: { type: 'number', description: '构建置信度 (0-1)' },
      reasons: { type: 'array', items: { type: 'string' }, description: '构建原因说明' },
      shouldUpdateSystemPrompt: {
        type: 'boolean',
        description: '是否应该更新系统提示词（工具返回 true 时，系统会自动更新）',
      },
    },
  },
};
