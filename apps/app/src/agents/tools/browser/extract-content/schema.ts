import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 浏览器提取内容的参数 Schema
 */
export const browserExtractContentParamsSchema = z.object({
  selector: z.string().optional().describe('要提取内容的元素选择器（CSS 选择器），如果为空则提取整个页面'),
  extractType: z.enum(['text', 'html', 'markdown']).default('text').optional().describe('提取类型：text（纯文本）、html（HTML）、markdown（Markdown）'),
});

export type BrowserExtractContentParams = z.infer<typeof browserExtractContentParamsSchema>;

export const browserExtractContentSchema: ToolDefinition = {
  name: 'browser_extract_content',
  description: '从浏览器页面中提取内容。可以提取指定元素的内容，或提取整个页面的内容。',
  displayName: {
    en: 'Browser Extract Content',
    'zh-CN': '浏览器提取内容',
    'zh-TW': '瀏覽器提取內容',
    ja: 'ブラウザコンテンツ抽出',
    ko: '브라우저 콘텐츠 추출',
  },
  parameters: zodToJsonSchema(browserExtractContentParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'browser',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      content: { type: 'string', description: '提取的内容' },
      contentType: { type: 'string', description: '内容类型（text/html/markdown）' },
    },
  },
};

