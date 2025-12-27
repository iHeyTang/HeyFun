import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 网络搜索的参数 Schema
 */
export const webSearchParamsSchema = z.object({
  query: z.string().min(1).describe('搜索查询关键词或问题'),
  maxResults: z.number().int().min(1).max(50).default(50).describe('返回的最大结果数量，范围 1-50，默认 50'),
  searchType: z.enum(['general', 'news', 'images']).default('general').describe('搜索类型：general（通用搜索）、news（新闻）、images（图片）'),
  engine: z.enum(['auto', 'bocha', 'serpapi', 'duckduckgo']).optional().describe('指定使用的搜索引擎提供者：bocha（博查）、serpapi（SerpAPI）、duckduckgo（DuckDuckGo），或 auto（自动选择最优的，默认值）'),
});

export type WebSearchParams = z.infer<typeof webSearchParamsSchema>;

export const webSearchSchema: ToolDefinition = {
  name: 'web_search',
  description: '在互联网上搜索信息。可以搜索各种主题的内容，返回相关的网页链接和摘要。支持配置 SerpAPI 以获得更好的搜索结果。',
  parameters: zodToJsonSchema(webSearchParamsSchema, {
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
        description: '搜索结果列表',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '结果标题' },
            snippet: { type: 'string', description: '结果摘要' },
            url: { type: 'string', description: '结果链接' },
            source: { type: 'string', description: '结果来源' },
          },
        },
      },
      count: { type: 'number', description: '结果数量' },
    },
  },
};

