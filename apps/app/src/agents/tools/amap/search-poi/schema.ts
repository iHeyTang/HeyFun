import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * POI搜索的参数 Schema
 */
export const searchPoiParamsSchema = z.object({
  keyword: z.string().min(1).describe('搜索关键词，例如 "餐厅"、"酒店"、"加油站" 等'),
  city: z.string().optional().describe('城市名称（可选），用于限定搜索范围，例如 "北京"、"上海"'),
  location: z
    .object({
      longitude: z.number().min(-180).max(180),
      latitude: z.number().min(-90).max(90),
    })
    .optional()
    .describe('中心点坐标（可选），如果提供则按距离排序'),
  radius: z.number().optional().describe('搜索半径（米），默认 3000，最大 50000'),
  types: z.string().optional().describe('POI类型（可选），例如 "餐饮服务|购物服务"，多个类型用 | 分隔'),
  page: z.number().int().min(1).default(1).describe('页码，从1开始'),
  pageSize: z.number().int().min(1).max(25).default(10).describe('每页记录数，最大25'),
});

export type SearchPoiParams = z.infer<typeof searchPoiParamsSchema>;

export const searchPoiSchema: ToolDefinition = {
  name: 'search_poi',
  description: '搜索兴趣点（POI），例如餐厅、酒店、加油站、景点等。支持按关键词、城市、坐标范围搜索。',
  parameters: zodToJsonSchema(searchPoiParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'utility',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      pois: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'POI名称' },
            type: { type: 'string', description: 'POI类型' },
            address: { type: 'string', description: '地址' },
            location: {
              type: 'object',
              properties: {
                longitude: { type: 'number', description: '经度' },
                latitude: { type: 'number', description: '纬度' },
              },
            },
            distance: { type: 'number', description: '距离（米），如果提供了中心点坐标' },
            tel: { type: 'string', description: '联系电话' },
          },
        },
      },
      count: { type: 'number', description: '总记录数' },
      page: { type: 'number', description: '当前页码' },
      pageSize: { type: 'number', description: '每页记录数' },
    },
  },
};
