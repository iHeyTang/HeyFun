import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const generateAudioSchema: ToolDefinition = {
  name: 'generate_audio',
  description: '使用AI模型生成音频（文本转语音，TTS）。将文本转换为自然语音。生成的音频会保存在paintboard中。',
  parameters: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: '要使用的AI模型名称。使用get_aigc_models工具查看可用模型列表。',
      },
      text: {
        type: 'string',
        description: '要转换为语音的文本内容',
      },
      voiceId: {
        type: 'string',
        description: '语音ID（可选），指定要使用的语音风格',
      },
      advanced: {
        type: 'object',
        description: '高级参数（可选），模型特定的额外参数',
      },
    },
    required: ['model', 'text'],
  },
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

