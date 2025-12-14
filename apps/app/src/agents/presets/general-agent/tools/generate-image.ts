import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const generateImageDefinition: ToolDefinition = {
  name: 'generate_image',
  description: '使用AI模型生成图片。支持文本生成图片（text-to-image）和图片转图片（image-to-image）。生成的图片会保存在paintboard中。',
  parameters: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: '要使用的AI模型名称。使用get_aigc_models工具查看可用模型列表。',
      },
      prompt: {
        type: 'string',
        description: '图片生成的提示词，描述你想要生成的图片内容',
      },
      referenceImage: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: '参考图片URL数组（可选），用于图片转图片（image-to-image）生成',
      },
      aspectRatio: {
        type: 'string',
        description: '图片宽高比（可选），例如：16:9, 1:1, 9:16等',
      },
      n: {
        type: 'string',
        description: '生成图片数量（可选），某些模型支持一次生成多张图片',
      },
      advanced: {
        type: 'object',
        description: '高级参数（可选），模型特定的额外参数',
      },
    },
    required: ['model', 'prompt'],
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
      generationType: { type: 'string', description: '生成类型：text-to-image 或 image-to-image' },
      message: { type: 'string', description: '任务提交结果消息' },
    },
  },
};
