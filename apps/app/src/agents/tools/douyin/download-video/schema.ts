import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 下载抖音视频的参数 Schema
 */
export const douyinDownloadVideoParamsSchema = z.object({
  url: z
    .string()
    .min(1)
    .describe(
      '抖音视频链接。支持以下格式：1) 短链接（https://v.douyin.com/xxxxx/）；2) 完整链接（https://www.douyin.com/video/xxxxx）；3) 视频 ID（纯数字）。',
    ),
  saveToAssets: z
    .boolean()
    .default(true)
    .optional()
    .describe('是否保存到项目资源。如果为 true，下载的视频将保存到项目资源库中，可以在后续对话中引用。默认为 true。'),
  quality: z
    .enum(['highest', 'high', 'medium', 'low'])
    .default('highest')
    .optional()
    .describe('视频质量。highest: 最高质量, high: 高质量, medium: 中等质量, low: 低质量。默认为 highest。'),
});

export type DouyinDownloadVideoParams = z.infer<typeof douyinDownloadVideoParamsSchema>;

export const douyinDownloadVideoSchema: ToolDefinition = {
  name: 'douyin_download_video',
  description:
    '下载抖音视频。工具会自动解析视频链接，获取视频信息，然后下载视频文件。下载的视频可以保存到项目资源库中。',
  displayName: {
    en: 'Download Douyin Video',
    'zh-CN': '下载抖音视频',
    'zh-TW': '下載抖音視頻',
    ja: 'Douyin動画をダウンロード',
    ko: 'Douyin 동영상 다운로드',
  },
  parameters: zodToJsonSchema(douyinDownloadVideoParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'douyin',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      videoId: { type: 'string', description: '视频 ID' },
      title: { type: 'string', description: '视频标题' },
      author: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '作者昵称' },
          id: { type: 'string', description: '作者 ID' },
        },
      },
      downloadUrl: { type: 'string', description: '下载的视频文件访问 URL' },
      fileName: { type: 'string', description: '视频文件名' },
      fileSize: { type: 'number', description: '文件大小（字节）' },
      assetId: { type: 'string', description: '如果保存到项目资源，返回资源 ID' },
      assetUrl: { type: 'string', description: '如果保存到项目资源，返回资源访问 URL' },
      videoUrl: { type: 'string', description: '原始视频 URL' },
      coverUrl: { type: 'string', description: '封面图片 URL' },
    },
  },
};
