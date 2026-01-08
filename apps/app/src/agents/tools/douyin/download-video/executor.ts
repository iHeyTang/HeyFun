import { ToolContext } from '../../context';
import { douyinDownloadVideoParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { parseDouyinVideo } from '../utils';
import { createAssetFromTool } from '@/agents/utils/asset-helper';

export const douyinDownloadVideoExecutor = definitionToolExecutor(
  douyinDownloadVideoParamsSchema,
  async (args, context) => {
    return await context.workflow.run(`toolcall-${context.toolCallId || 'douyin-download-video'}`, async () => {
      try {
        if (!context.sessionId || !context.organizationId) {
          return {
            success: false,
            error: 'Session ID and Organization ID are required',
          };
        }

        const { url, saveToAssets = true, quality = 'highest' } = args;

        // 1. 解析视频信息
        const videoInfo = await parseDouyinVideo(url);

        if (!videoInfo.videoUrl) {
          return {
            success: false,
            error: 'Failed to get video URL from video info',
          };
        }

        // 2. 下载视频文件
        const videoResponse = await fetch(videoInfo.videoUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Referer': 'https://www.douyin.com/',
          },
        });

        if (!videoResponse.ok) {
          return {
            success: false,
            error: `Failed to download video: HTTP ${videoResponse.status}`,
          };
        }

        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        const fileName = `${videoInfo.videoId || 'douyin-video'}.mp4`;

        // 3. 如果需要保存到资源库
        let assetId: string | undefined;
        let assetUrl: string | undefined;

        if (saveToAssets) {
          try {
            const asset = await createAssetFromTool({
              context,
              fileContent: videoBuffer,
              fileName,
              mimeType: 'video/mp4',
              title: videoInfo.title || '抖音视频',
              description: `作者: ${videoInfo.author.name}\n${videoInfo.description || ''}`,
              type: 'video',
              tags: ['douyin', 'video'],
              metadata: {
                videoId: videoInfo.videoId,
                author: videoInfo.author,
                stats: videoInfo.stats,
                publishTime: videoInfo.publishTime,
                sourceUrl: url,
                downloadTime: new Date().toISOString(),
              },
            });

            assetId = asset.id;
            assetUrl = asset.fileUrl;
          } catch (error) {
            console.error('[DouyinDownloadVideo] Failed to save to assets:', error);
            // 不阻止返回结果，但记录错误
          }
        }

        return {
          success: true,
          data: {
            videoId: videoInfo.videoId,
            title: videoInfo.title,
            author: {
              name: videoInfo.author.name,
              id: videoInfo.author.id,
            },
            downloadUrl: assetUrl || videoInfo.videoUrl,
            fileName,
            fileSize: videoBuffer.length,
            assetId,
            assetUrl,
            videoUrl: videoInfo.videoUrl,
            coverUrl: videoInfo.coverUrl,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
  },
);
