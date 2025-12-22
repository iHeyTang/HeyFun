import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const waitSchema: ToolDefinition = {
  name: 'wait',
  description: '等待指定的时间。用于在异步任务（如AIGC生成）后等待一段时间，然后再查询结果。可以按秒或毫秒指定等待时间。',
  parameters: {
    type: 'object',
    properties: {
      seconds: {
        type: 'number',
        description: '等待的秒数（可选，与milliseconds二选一）',
        minimum: 0,
        maximum: 60,
      },
      milliseconds: {
        type: 'number',
        description: '等待的毫秒数（可选，与seconds二选一）',
        minimum: 0,
        maximum: 60000,
      },
    },
    required: [],
  },
  runtime: ToolRuntime.SERVER,
  category: 'utility',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      waited: { type: 'number', description: '实际等待的毫秒数' },
      unit: { type: 'string', description: '时间单位：milliseconds' },
      message: { type: 'string', description: '等待完成的消息' },
    },
  },
};

