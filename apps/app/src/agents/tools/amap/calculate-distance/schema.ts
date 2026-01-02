import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 距离计算的参数 Schema
 */
export const calculateDistanceParamsSchema = z.object({
  origin: z
    .object({
      longitude: z.number().min(-180).max(180),
      latitude: z.number().min(-90).max(90),
    })
    .describe('起点坐标'),
  destination: z
    .object({
      longitude: z.number().min(-180).max(180),
      latitude: z.number().min(-90).max(90),
    })
    .describe('终点坐标'),
  type: z.enum(['1', '0']).default('1').describe('计算类型：1-直线距离，0-驾车距离（需要路径规划）'),
});

export type CalculateDistanceParams = z.infer<typeof calculateDistanceParamsSchema>;

export const calculateDistanceSchema: ToolDefinition = {
  name: 'calculate_distance',
  description: '计算两点之间的距离。支持直线距离和驾车距离两种计算方式。',
  displayName: {
    en: 'Calculate Distance',
    'zh-CN': '计算距离',
    'zh-TW': '計算距離',
    ja: '距離を計算',
    ko: '거리 계산',
  },
  parameters: zodToJsonSchema(calculateDistanceParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'utility',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      distance: { type: 'number', description: '距离（米）' },
      duration: { type: 'number', description: '预计时间（秒），仅驾车距离时返回' },
      type: { type: 'string', description: '计算类型：直线距离或驾车距离' },
    },
  },
};
