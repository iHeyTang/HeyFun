import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { A302aiProvider } from '../providers/a302ai';
import { GenerationTaskResult, GenerationType } from '../types';
import { getMediaDuration } from '../utils/downloader';

const paramsSchema = z.object({
  video: z.string(),
});

/**
 * Topzlabs Video
 * https://doc.302.ai/355746634e0
 * https://developer.topazlabs.com/video-api/available-models#advanced-models-enhancement
 */
export class TopzlabsVideo extends BaseAigcModel {
  name = 'topzlabs-video';
  displayName = 'Topzlabs Video';
  description = 'Topzlabs Video';
  costDescription = 'Normal: 1 Credits/s';
  generationTypes = ['video-to-video'] as GenerationType[];

  paramsSchema = paramsSchema;

  providerName = '302ai';
  provider: A302aiProvider;
  constructor(provider: A302aiProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const body = {
      file: params.video,
      filters: [{ model: 'prob-4' }],
      output: {
        resolution: { width: 3840, height: 2160 },
        frameRate: 24,
        audioCodec: 'AAC',
        audioTransfer: 'Copy',
        dynamicCompressionLevel: 'High',
      },
    };
    const data = await this.provider.request<{ cost: number; requestId: string }>({
      path: '/topazlabs/video/upload',
      method: 'POST',
      body,
    });
    if (!data.requestId) {
      throw new Error('Unknown error');
    }
    return data.requestId;
  }

  async getTaskResult(params: { model: string; taskId: string; params: z.infer<typeof paramsSchema> }): Promise<GenerationTaskResult> {
    const path = `/topazlabs/video/${params.taskId}/status`;
    const data = await this.provider.request<{
      download?: {
        expiresAt: number;
        expiresIn: number;
        url: string;
      };
      message: string;
      outputSize: string;
      progress: number;
      status: 'initializing' | 'processing' | 'complete';
    }>({ path, method: 'GET' });

    console.log('getTaskResult', JSON.stringify(data));
    const status = this.getStatus(data.status);

    if (status !== 'completed' || !data.download?.url) {
      return {
        status,
      };
    }

    return {
      status,
      data: [{ data: data.download?.url, sourceType: 'url', type: 'video' }],
      usage: { video_count: 1 },
    };
  }

  private getStatus(
    status: 'initializing' | 'processing' | 'postprocessing' | 'complete' | 'failed',
  ): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (status) {
      case 'failed':
        return 'failed';
      case 'complete':
        return 'completed';
      default:
        return 'processing';
    }
  }

  /**
   * 精确计算成本（推荐使用此方法获得最准确的价格）
   * 使用真实的媒体文件元数据获取精确时长
   */
  async calculateCost(params: z.infer<typeof this.paramsSchema>, outputs: GenerationTaskResult): Promise<number> {
    const videoDuration = await getMediaDuration((outputs.data?.[0]?.data as string) || '');
    return videoDuration * 1000;
  }
}
