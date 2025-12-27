import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 地理编码的参数 Schema
 */
export const geocodeParamsSchema = z.object({
  address: z.string().min(1).describe('地址，例如 "北京市朝阳区"、"上海市浦东新区" 等'),
  city: z.string().optional().describe('城市名称（可选），用于限定搜索范围，例如 "北京"、"上海"'),
});

export type GeocodeParams = z.infer<typeof geocodeParamsSchema>;

export const geocodeSchema: ToolDefinition = {
  name: 'geocode',
  description: '将地址转换为地理坐标（经纬度）。支持中文地址，例如 "北京市朝阳区"、"上海市浦东新区" 等。',
  parameters: zodToJsonSchema(geocodeParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'utility',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      address: { type: 'string', description: '原始地址' },
      formattedAddress: { type: 'string', description: '格式化后的完整地址' },
      location: {
        type: 'object',
        properties: {
          longitude: { type: 'number', description: '经度' },
          latitude: { type: 'number', description: '纬度' },
        },
      },
      province: { type: 'string', description: '省份' },
      city: { type: 'string', description: '城市' },
      district: { type: 'string', description: '区县' },
      adcode: { type: 'string', description: '区域编码' },
    },
  },
};
