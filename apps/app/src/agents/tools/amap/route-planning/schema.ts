import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 路径规划的参数 Schema
 */
export const routePlanningParamsSchema = z.object({
  origin: z
    .union([
      z.string().describe('起点地址字符串，例如 "北京市朝阳区"'),
      z
        .object({
          longitude: z.number().min(-180).max(180),
          latitude: z.number().min(-90).max(90),
        })
        .describe('起点坐标'),
    ])
    .describe('起点，可以是地址字符串或坐标对象'),
  destination: z
    .union([
      z.string().describe('终点地址字符串，例如 "上海市浦东新区"'),
      z
        .object({
          longitude: z.number().min(-180).max(180),
          latitude: z.number().min(-90).max(90),
        })
        .describe('终点坐标'),
    ])
    .describe('终点，可以是地址字符串或坐标对象'),
  strategy: z
    .enum(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'])
    .default('0')
    .describe(
      '路径规划策略：0-速度优先（时间最短），1-费用优先（不走收费路段的最快道路），2-距离优先，3-不走快速路，4-躲避拥堵，5-多策略（同时使用速度优先、费用优先、距离优先三个策略），6-不走高速，7-不走高速且避免收费，8-躲避收费和拥堵，9-不走高速且躲避收费和拥堵，10-多备选方案，11-速度优先（考虑路况），12-躲避拥堵（考虑路况），13-距离优先（考虑路况）',
    ),
  waypoints: z
    .array(
      z.union([
        z.string(),
        z.object({
          longitude: z.number().min(-180).max(180),
          latitude: z.number().min(-90).max(90),
        }),
      ]),
    )
    .optional()
    .describe('途经点数组（可选），最多支持16个途经点'),
});

export type RoutePlanningParams = z.infer<typeof routePlanningParamsSchema>;

export const routePlanningSchema: ToolDefinition = {
  name: 'route_planning',
  description: '规划两点之间的路径，支持多种策略（速度优先、距离优先、躲避拥堵等）。支持起点和终点使用地址或坐标。',
  displayName: {
    en: 'Route Planning',
    'zh-CN': '路径规划',
    'zh-TW': '路徑規劃',
    ja: 'ルート計画',
    ko: '경로 계획',
  },
  parameters: zodToJsonSchema(routePlanningParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'utility',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      routes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            distance: { type: 'number', description: '总距离（米）' },
            duration: { type: 'number', description: '预计时间（秒）' },
            tolls: { type: 'number', description: '过路费（元）' },
            tollDistance: { type: 'number', description: '收费路段距离（米）' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  instruction: { type: 'string', description: '导航指令' },
                  road: { type: 'string', description: '道路名称' },
                  distance: { type: 'number', description: '路段距离（米）' },
                  duration: { type: 'number', description: '路段耗时（秒）' },
                },
              },
            },
          },
        },
      },
    },
  },
};
