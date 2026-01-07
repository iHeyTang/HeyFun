import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 浏览器点击的参数 Schema
 */
export const browserClickParamsSchema = z.object({
  selector: z.string().describe('要点击的元素选择器（CSS 选择器或 XPath）'),
  timeout: z.number().int().min(1000).max(30000).default(10000).optional().describe('等待元素出现的超时时间（毫秒），默认 10 秒'),
});

export type BrowserClickParams = z.infer<typeof browserClickParamsSchema>;

export const browserClickSchema: ToolDefinition = {
  name: 'browser_click',
  description: '在浏览器中点击指定的元素。使用 CSS 选择器或 XPath 定位元素。',
  displayName: {
    en: 'Browser Click',
    'zh-CN': '浏览器点击',
    'zh-TW': '瀏覽器點擊',
    ja: 'ブラウザクリック',
    ko: '브라우저 클릭',
  },
  parameters: zodToJsonSchema(browserClickParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'browser',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      clicked: { type: 'boolean', description: '是否成功点击' },
    },
  },
};

