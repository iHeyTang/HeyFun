import { ToolContext } from '../../context';
import { douyinGetVideoInfoParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { parseDouyinVideo } from '../utils';

export const douyinGetVideoInfoExecutor = definitionToolExecutor(
  douyinGetVideoInfoParamsSchema,
  async (args, context) => {
    return await context.workflow.run(`toolcall-${context.toolCallId || 'douyin-get-video-info'}`, async () => {
      try {
        const { url } = args;

        // 使用 TikHub.io API 解析视频信息
        const videoInfo = await parseDouyinVideo(url);

        return {
          success: true,
          data: videoInfo,
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
