import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 生成音乐的参数 Schema
 */
export const generateMusicParamsSchema = z
  .object({
    model: z.string().min(1).describe('要使用的AI模型名称。使用get_aigc_models工具查看可用模型列表。'),
    lyrics: z.string().optional().describe('歌词内容（可选），如果提供歌词，模型会生成带歌词的音乐'),
    prompt: z.string().optional().describe('音乐生成提示词（可选），描述你想要生成的音乐风格、情感、节奏等'),
    advanced: z.record(z.any()).optional().describe('高级参数（可选），模型特定的额外参数'),
  })
  .refine(data => data.lyrics || data.prompt, {
    message: 'At least one of lyrics or prompt is required',
  });

export type GenerateMusicParams = z.infer<typeof generateMusicParamsSchema>;

export const generateMusicSchema: ToolDefinition = {
  name: 'generate_music',
  description: '使用AI模型生成音乐。可以基于歌词或提示词生成音乐。生成的音乐会保存在paintboard中。',
  parameters: zodToJsonSchema(generateMusicParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'aigc',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      taskId: { type: 'string', description: '任务ID，用于查询任务状态' },
      status: { type: 'string', description: '任务状态：pending, processing, completed, failed' },
      model: { type: 'string', description: '使用的模型名称' },
      generationType: { type: 'string', description: '生成类型：music' },
      message: { type: 'string', description: '任务提交结果消息' },
    },
  },
};

