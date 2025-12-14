import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const getCurrentWeatherDefinition: ToolDefinition = {
  name: 'get_current_weather',
  description: '获取指定城市的当前天气信息，包括温度、湿度、天气状况等。',
  parameters: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: '城市名称，例如 "北京"、"Shanghai"、"New York" 等',
      },
      unit: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: '温度单位：celsius（摄氏度）或 fahrenheit（华氏度）',
        default: 'celsius',
      },
    },
    required: ['city'],
  },
  runtime: ToolRuntime.SERVER,
  category: 'utility',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      city: { type: 'string' },
      temperature: { type: 'number', description: '温度' },
      unit: { type: 'string', description: '温度单位' },
      condition: { type: 'string', description: '天气状况，例如 "晴天"、"多云"、"小雨" 等' },
      humidity: { type: 'number', description: '湿度百分比' },
      windSpeed: { type: 'number', description: '风速（km/h）' },
      description: { type: 'string', description: '天气描述' },
    },
  },
};

