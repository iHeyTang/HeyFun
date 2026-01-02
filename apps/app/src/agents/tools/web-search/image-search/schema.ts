import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 图片搜索的参数 Schema
 */
export const imageSearchParamsSchema = z.object({
  query: z.string().min(1).describe('图片搜索查询关键词或描述'),
  maxResults: z.number().int().min(1).max(50).default(10).describe('返回的最大结果数量，范围 1-50，默认 10'),
  imageType: z.enum(['all', 'photo', 'clipart', 'lineart', 'face', 'animated']).default('all').describe('图片类型过滤：all（全部）、photo（照片）、clipart（剪贴画）、lineart（线条图）、face（人脸）、animated（动画）'),
  size: z.enum(['all', 'large', 'medium', 'icon']).default('all').describe('图片尺寸过滤：all（全部）、large（大图）、medium（中等）、icon（图标）'),
});

export type ImageSearchParams = z.infer<typeof imageSearchParamsSchema>;

export const imageSearchSchema: ToolDefinition = {
  name: 'image_search',
  description: '在互联网上搜索图片。可以搜索特定主题的图片，返回图片链接、缩略图和相关信息。',
  displayName: {
    en: 'Image Search',
    'zh-CN': '图片搜索',
    'zh-TW': '圖片搜尋',
    ja: '画像検索',
    ko: '이미지 검색',
  },
  parameters: zodToJsonSchema(imageSearchParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'web_search',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      query: { type: 'string', description: '搜索查询' },
      results: {
        type: 'array',
        description: '图片结果列表',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '图片标题' },
            thumbnail: { type: 'string', description: '缩略图 URL' },
            image: { type: 'string', description: '原图 URL' },
            url: { type: 'string', description: '图片所在页面链接' },
            source: { type: 'string', description: '图片来源' },
            width: { type: 'number', description: '图片宽度（像素）' },
            height: { type: 'number', description: '图片高度（像素）' },
            type: { type: 'string', description: '结果类型，固定为 "image"' },
          },
        },
      },
      count: { type: 'number', description: '结果数量' },
    },
  },
};

