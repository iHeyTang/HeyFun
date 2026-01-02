import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 逆地理编码的参数 Schema
 */
export const reverseGeocodeParamsSchema = z.object({
  longitude: z.number().min(-180).max(180).describe('经度，范围 -180 到 180'),
  latitude: z.number().min(-90).max(90).describe('纬度，范围 -90 到 90'),
  radius: z.number().optional().describe('搜索半径（米），默认 1000'),
});

export type ReverseGeocodeParams = z.infer<typeof reverseGeocodeParamsSchema>;

export const reverseGeocodeSchema: ToolDefinition = {
  name: 'reverse_geocode',
  description: '将地理坐标（经纬度）转换为地址。输入经纬度坐标，返回对应的地址信息。',
  displayName: {
    en: 'Reverse Geocode',
    'zh-CN': '逆地理编码',
    'zh-TW': '逆地理編碼',
    ja: '逆ジオコーディング',
    ko: '역 지오코딩',
  },
  parameters: zodToJsonSchema(reverseGeocodeParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'utility',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      formattedAddress: { type: 'string', description: '格式化后的完整地址' },
      province: { type: 'string', description: '省份' },
      city: { type: 'string', description: '城市' },
      district: { type: 'string', description: '区县' },
      street: { type: 'string', description: '街道' },
      streetNumber: { type: 'string', description: '门牌号' },
      adcode: { type: 'string', description: '区域编码' },
      location: {
        type: 'object',
        properties: {
          longitude: { type: 'number', description: '经度' },
          latitude: { type: 'number', description: '纬度' },
        },
      },
    },
  },
};
