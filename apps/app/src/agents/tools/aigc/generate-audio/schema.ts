import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 生成音频的参数 Schema
 */
export const generateAudioParamsSchema = z.object({
  model: z.string().min(1).describe('要使用的AI模型名称。使用get_aigc_models工具查看可用模型列表。'),
  text: z.string().min(1).describe('要转换为语音的文本内容'),
  voiceId: z.string().optional().describe('语音ID（可选），指定要使用的语音风格'),
  advanced: z.record(z.any()).optional().describe('高级参数（可选），模型特定的额外参数'),
});

export type GenerateAudioParams = z.infer<typeof generateAudioParamsSchema>;

export const generateAudioSchema: ToolDefinition = {
  name: 'generate_audio',
  description: '使用AI模型生成音频（文本转语音，TTS）。将文本转换为自然语音。生成的音频会保存在paintboard中。',
  displayName: {
    en: 'Generate Audio',
    'zh-CN': '生成音频',
    'zh-TW': '生成音訊',
    ja: '音声を生成',
    ko: '오디오 생성',
  },
  parameters: zodToJsonSchema(generateAudioParamsSchema, {
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
      generationType: { type: 'string', description: '生成类型：text-to-speech' },
      message: { type: 'string', description: '任务提交结果消息' },
    },
  },
};

