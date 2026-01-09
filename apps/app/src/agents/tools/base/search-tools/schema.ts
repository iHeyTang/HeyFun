import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 工具检索参数 Schema
 */
export const searchToolsParamsSchema = z.object({
  keyword: z.string().optional().describe('关键词，用于匹配工具名称、描述、分类等，当为空时，返回所有工具'),
  category: z.string().optional().describe('工具分类过滤，例如 "utility"、"aigc"、"notes" 等，当为空时，返回所有工具'),
  maxResults: z.number().int().min(1).max(500).default(10).describe('最大返回结果数量，默认10，最多500'),
});

export type SearchToolsParams = z.infer<typeof searchToolsParamsSchema>;

export const searchToolsSchema: ToolDefinition = {
  name: 'search_tools',
  description: '在工具库中检索可用的工具。根据关键词、分类等条件搜索工具，返回匹配的工具列表及其使用手册。这是agent获取可用工具的主要方式。',
  displayName: {
    en: 'Search Tools',
    'zh-CN': '搜索工具',
    'zh-TW': '搜尋工具',
    ja: 'ツールを検索',
    ko: '도구 검색',
  },
  parameters: zodToJsonSchema(searchToolsParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'agent',
  manual: `# search_tools 工具使用手册

## 功能说明
search_tools 用于在工具库中检索可用的工具。当agent需要了解有哪些工具可用，或者需要根据任务需求查找合适的工具时，可以使用此工具。

## 使用场景
1. **任务开始时**：了解当前可用的工具，规划任务执行方案
2. **需要特定功能时**：根据任务需求搜索相关工具
3. **工具选择时**：比较不同工具的功能和适用场景

## 参数说明
- **keyword**（可选）：关键词，会匹配工具名称、描述、分类等。例如："搜索"、"图片"、"笔记"等
- **category**（可选）：工具分类，例如："utility"（工具类）、"aigc"（AIGC类）、"notes"（笔记类）等
- **maxResults**（可选）：最大返回结果数量，默认10，最多50

## 返回结果
返回匹配的工具列表，每个工具包含：
- 工具名称和描述
- 参数Schema
- 使用手册（如果存在）
- 匹配度评分

## 使用建议
1. 在开始新任务前，先使用此工具了解可用工具
2. 使用具体的关键词可以提高检索精度
3. 检索到工具后，查看工具的使用手册以了解如何正确使用
4. 根据任务需求选择合适的工具，可以同时检索多个工具进行比较

## 示例
- 搜索与"图片"相关的工具：keyword="图片"
- 查找所有笔记相关工具：category="notes"`,
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      tools: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            manual: { type: 'string' },
            score: { type: 'number' },
          },
        },
      },
      total: { type: 'number' },
    },
  },
};
