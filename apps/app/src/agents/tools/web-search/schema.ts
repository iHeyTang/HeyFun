import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const webSearchSchema: ToolDefinition = {
  name: 'web_search',
  description: '在互联网上搜索信息。可以搜索各种主题的内容，返回相关的网页链接和摘要。支持配置 SerpAPI 以获得更好的搜索结果。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询关键词或问题',
      },
      maxResults: {
        type: 'number',
        description: '返回的最大结果数量，范围 1-50，默认 10',
        default: 10,
        minimum: 1,
        maximum: 50,
      },
      searchType: {
        type: 'string',
        enum: ['general', 'news', 'images'],
        description: '搜索类型：general（通用搜索）、news（新闻）、images（图片）',
        default: 'general',
      },
    },
    required: ['query'],
  },
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

