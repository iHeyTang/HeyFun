import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 浏览器下载资源的参数 Schema
 */
export const browserDownloadParamsSchema = z.object({
  url: z.string().describe('要下载的资源 URL（可以是绝对 URL 或相对 URL）。如果是相对 URL，将基于当前页面 URL 解析。'),
  timeout: z.number().int().min(1000).max(300000).default(60000).optional().describe('下载超时时间（毫秒），默认 60 秒'),
  saveToAssets: z
    .boolean()
    .default(false)
    .optional()
    .describe('是否保存到项目资源。如果为 true，下载的文件将保存到项目资源库中，可以在后续对话中引用。'),
});

export type BrowserDownloadParams = z.infer<typeof browserDownloadParamsSchema>;

export const browserDownloadSchema: ToolDefinition = {
  name: 'browser_download',
  description:
    '从浏览器当前页面下载指定 URL 的资源。支持绝对 URL 和相对 URL。下载的文件会自动上传到存储并返回访问 URL。如果需要下载资源，必须使用此工具。',
  displayName: {
    en: 'Browser Download',
    'zh-CN': '浏览器下载',
    'zh-TW': '瀏覽器下載',
    ja: 'ブラウザダウンロード',
    ko: '브라우저 다운로드',
  },
  parameters: zodToJsonSchema(browserDownloadParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'browser',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      downloadUrl: { type: 'string', description: '下载文件的访问 URL' },
      fileName: { type: 'string', description: '文件名' },
      fileSize: { type: 'number', description: '文件大小（字节）' },
      url: { type: 'string', description: '原始下载 URL' },
      assetId: { type: 'string', description: '如果保存到项目资源，返回资源 ID' },
      assetUrl: { type: 'string', description: '如果保存到项目资源，返回资源访问 URL' },
    },
  },
};
