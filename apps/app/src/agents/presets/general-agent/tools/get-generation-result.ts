import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const getGenerationResultDefinition: ToolDefinition = {
  name: 'get_generation_result',
  description: '获取AIGC生成任务的结果。通过任务ID查询任务状态和生成结果。如果任务已完成，返回生成的文件URL；如果任务还在处理中，返回当前状态。',
  parameters: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: '生成任务的ID（从generate_image、generate_video等工具返回的taskId）',
      },
    },
    required: ['taskId'],
  },
  runtime: ToolRuntime.SERVER,
  category: 'aigc',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      taskId: { type: 'string', description: '任务ID' },
      status: {
        type: 'string',
        enum: ['pending', 'processing', 'completed', 'failed'],
        description: '任务状态：pending（等待中）、processing（处理中）、completed（已完成）、failed（失败）',
      },
      model: { type: 'string', description: '使用的模型名称' },
      generationType: { type: 'string', description: '生成类型' },
      results: {
        type: 'array',
        description: '生成结果列表（任务完成时包含文件URL等信息）',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: '文件存储key' },
            url: { type: 'string', description: '文件访问URL（签名URL，1小时有效）' },
            type: { type: 'string', description: '文件类型：image、video、audio等' },
          },
        },
      },
      error: { type: 'string', description: '错误信息（如果任务失败）' },
      createdAt: { type: 'string', description: '任务创建时间' },
      updatedAt: { type: 'string', description: '任务更新时间' },
    },
  },
};
