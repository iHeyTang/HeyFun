import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const searchNewsDefinition: ToolDefinition = {
  name: 'search_news',
  description: '搜索最新的新闻资讯。可以搜索特定主题的新闻文章，返回新闻标题、摘要和链接。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '新闻搜索查询关键词或主题',
      },
      maxResults: {
        type: 'number',
        description: '返回的最大结果数量，范围 1-50，默认 10',
        default: 10,
        minimum: 1,
        maximum: 50,
      },
      language: {
        type: 'string',
        description: '搜索语言，例如 "zh-CN"、"en-US" 等，默认 "zh-CN"',
        default: 'zh-CN',
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
        description: '新闻结果列表',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '新闻标题' },
            snippet: { type: 'string', description: '新闻摘要' },
            url: { type: 'string', description: '新闻链接' },
            source: { type: 'string', description: '新闻来源' },
            date: { type: 'string', description: '发布日期（如果有）' },
            type: { type: 'string', description: '结果类型，固定为 "news"' },
          },
        },
      },
      count: { type: 'number', description: '结果数量' },
    },
  },
};

