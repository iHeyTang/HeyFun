import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 发现 MCP 工具的参数 Schema
 */
export const mcpDiscoverToolsParamsSchema = z.object({
  configId: z.string().optional().describe('MCP 配置 ID。如果未提供，将发现所有已配置的 MCP 工具。'),
});

export type MCPDiscoverToolsParams = z.infer<typeof mcpDiscoverToolsParamsSchema>;

export const mcpDiscoverToolsSchema: ToolDefinition = {
  name: 'mcp_discover_tools',
  description:
    '发现并注册 MCP 服务器提供的工具。工具会自动注册到系统中，Agent 可以立即使用这些工具。',
  displayName: {
    en: 'Discover MCP Tools',
    'zh-CN': '发现 MCP 工具',
    'zh-TW': '發現 MCP 工具',
    ja: 'MCP ツールを発見',
    ko: 'MCP 도구 발견',
  },
  parameters: zodToJsonSchema(mcpDiscoverToolsParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'mcp',
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
          },
        },
      },
      count: { type: 'number' },
    },
  },
};
