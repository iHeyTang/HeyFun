import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 获取天气的参数 Schema
 */
export const getCurrentWeatherParamsSchema = z.object({
  city: z.string().min(1).describe('城市名称，例如 "北京"、"Shanghai"、"New York" 等'),
  unit: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('温度单位：celsius（摄氏度）或 fahrenheit（华氏度）'),
});

export type GetCurrentWeatherParams = z.infer<typeof getCurrentWeatherParamsSchema>;

export const getCurrentWeatherSchema: ToolDefinition = {
  name: 'get_current_weather',
  description: '获取指定城市的当前天气信息，包括温度、湿度、天气状况等。',
  parameters: zodToJsonSchema(getCurrentWeatherParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'utility',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      city: { type: 'string', description: '城市名称' },
      temperature: { type: 'number', description: '温度' },
      unit: { type: 'string', description: '温度单位' },
      condition: { type: 'string', description: '天气状况，例如 "晴"、"多云"、"小雨" 等' },
      humidity: { type: 'number', description: '湿度百分比' },
      windDirection: { type: 'string', description: '风向' },
      windPower: { type: 'string', description: '风力等级' },
      province: { type: 'string', description: '省份' },
      reportTime: { type: 'string', description: '数据发布时间' },
      description: { type: 'string', description: '天气描述' },
    },
  },
};
