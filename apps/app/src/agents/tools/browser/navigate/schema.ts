import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 浏览器导航的参数 Schema
 */
export const browserNavigateParamsSchema = z.object({
  url: z.string().url().describe('要导航到的 URL'),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).default('load').optional().describe('等待页面加载完成的策略'),
  timeout: z.number().int().min(1000).max(60000).default(30000).optional().describe('超时时间（毫秒），默认 30 秒'),
});

export type BrowserNavigateParams = z.infer<typeof browserNavigateParamsSchema>;

export const browserNavigateSchema: ToolDefinition = {
  name: 'browser_navigate',
  description: '在浏览器中导航到指定的 URL。会在 sandbox 中启动浏览器并加载页面。',
  displayName: {
    en: 'Browser Navigate',
    'zh-CN': '浏览器导航',
    'zh-TW': '瀏覽器導航',
    ja: 'ブラウザナビゲーション',
    ko: '브라우저 탐색',
  },
  parameters: zodToJsonSchema(browserNavigateParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'browser',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      url: { type: 'string', description: '实际访问的 URL' },
      title: { type: 'string', description: '页面标题' },
      screenshot: { type: 'string', description: '页面截图（URL 或 base64 编码）' },
    },
  },
};

