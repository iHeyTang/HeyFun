import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const generateMusicSchema: ToolDefinition = {
  name: 'generate_music',
  description: '使用AI模型生成音乐。可以基于歌词或提示词生成音乐。生成的音乐会保存在paintboard中。',
  parameters: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: '要使用的AI模型名称。使用get_aigc_models工具查看可用模型列表。',
      },
      lyrics: {
        type: 'string',
        description: '歌词内容（可选），如果提供歌词，模型会生成带歌词的音乐',
      },
      prompt: {
        type: 'string',
        description: '音乐生成提示词（可选），描述你想要生成的音乐风格、情感、节奏等',
      },
      advanced: {
        type: 'object',
        description: '高级参数（可选），模型特定的额外参数',
      },
    },
    required: ['model'],
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
      generationType: { type: 'string', description: '生成类型：music' },
      message: { type: 'string', description: '任务提交结果消息' },
    },
  },
};

