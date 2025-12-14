import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const getCurrentTimeDefinition: ToolDefinition = {
  name: 'get_current_time',
  description: '获取当前时间和日期。可以获取指定时区的时间，如果不指定时区则返回服务器本地时间。',
  parameters: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: '时区名称（可选），例如 "Asia/Shanghai"、"America/New_York"、"UTC" 等。如果不提供，返回服务器本地时间。',
      },
      format: {
        type: 'string',
        enum: ['iso', 'locale', 'timestamp'],
        description: '返回格式：iso（ISO 8601 格式）、locale（本地化格式）、timestamp（Unix 时间戳）',
        default: 'iso',
      },
    },
  },
  runtime: ToolRuntime.SERVER,
  category: 'utility',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      time: { type: 'string', description: '格式化后的时间字符串' },
      timestamp: { type: 'number', description: 'Unix 时间戳（毫秒）' },
      timezone: { type: 'string', description: '使用的时区' },
    },
  },
};

