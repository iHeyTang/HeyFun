import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 百科搜索的参数 Schema
 */
export const wikiSearchParamsSchema = z.object({
  query: z.string().min(1).describe('百科搜索查询关键词或主题名称'),
  maxResults: z.number().int().min(1).max(20).default(5).describe('返回的最大结果数量，范围 1-20，默认 5'),
  language: z.string().default('zh').describe('搜索语言代码，如 zh（中文）、en（英文）、ja（日文）等，默认 zh'),
});

export type WikiSearchParams = z.infer<typeof wikiSearchParamsSchema>;

export const wikiSearchSchema: ToolDefinition = {
  name: 'wiki_search',
  description: '在百科网站（如维基百科）上搜索信息。专注于获取结构化的百科知识，包括词条摘要、详细内容、相关链接等。适合查询人物、地点、概念、历史事件等百科类信息。',
  displayName: {
    en: 'Wiki Search',
    'zh-CN': '百科搜索',
    'zh-TW': '百科搜尋',
    ja: '百科検索',
    ko: '백과 검색',
  },
  parameters: zodToJsonSchema(wikiSearchParamsSchema, {
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
        description: '百科搜索结果列表',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '词条标题' },
            extract: { type: 'string', description: '词条摘要' },
            url: { type: 'string', description: '词条链接' },
            pageId: { type: 'number', description: '页面ID' },
            thumbnail: { type: 'string', description: '缩略图URL（如果有）' },
            language: { type: 'string', description: '语言代码' },
          },
        },
      },
      count: { type: 'number', description: '结果数量' },
    },
  },
};

