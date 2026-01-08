import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 获取抖音视频信息的参数 Schema
 */
export const douyinGetVideoInfoParamsSchema = z.object({
  url: z
    .string()
    .min(1)
    .describe(
      '抖音视频链接。支持以下格式：1) 短链接（https://v.douyin.com/xxxxx/）；2) 完整链接（https://www.douyin.com/video/xxxxx）；3) 视频 ID（纯数字）。',
    ),
});

export type DouyinGetVideoInfoParams = z.infer<typeof douyinGetVideoInfoParamsSchema>;

export const douyinGetVideoInfoSchema: ToolDefinition = {
  name: 'douyin_get_video_info',
  description:
    '获取抖音视频的详细信息，包括标题、作者、视频 URL、封面、统计数据（点赞、评论、分享、播放量）等。这是下载视频前获取视频信息的工具。',
  displayName: {
    en: 'Get Douyin Video Info',
    'zh-CN': '获取抖音视频信息',
    'zh-TW': '獲取抖音視頻信息',
    ja: 'Douyin動画情報を取得',
    ko: 'Douyin 동영상 정보 가져오기',
  },
  parameters: zodToJsonSchema(douyinGetVideoInfoParamsSchema, {
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
          avatar: { type: 'string', description: '作者头像 URL' },
        },
      },
      videoUrl: { type: 'string', description: '视频播放 URL' },
      coverUrl: { type: 'string', description: '封面图片 URL' },
      duration: { type: 'number', description: '视频时长（秒）' },
      description: { type: 'string', description: '视频描述' },
      stats: {
        type: 'object',
        properties: {
          likeCount: { type: 'number', description: '点赞数' },
          commentCount: { type: 'number', description: '评论数' },
          shareCount: { type: 'number', description: '分享数' },
          viewCount: { type: 'number', description: '播放数' },
        },
      },
      publishTime: { type: 'string', description: '发布时间（ISO 格式）' },
    },
  },
};
