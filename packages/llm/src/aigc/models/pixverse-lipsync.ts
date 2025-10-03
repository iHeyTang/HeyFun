import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { A302aiProvider } from '../providers/a302ai';
import { GenerationTaskResult, GenerationType } from '../types';
import { getMediaDuration } from '../utils/downloader';

const paramsSchema = z.object({
  video: z.string(),
  audio: z.string(),
});

/**
 * Pixverse Lipsync
 * https://doc.302.ai/331073209e0
 */
export class PixverseLipsync extends BaseAigcModel {
  name = 'pixverse-lipsync';
  displayName = 'Pixverse Lipsync';
  description = 'Pixverse Lipsync';
  costDescription = '0.5 Credits/s';
  generationTypes = ['lip-sync'] as GenerationType[];

  paramsSchema = paramsSchema;

  providerName = '302ai';
  provider: A302aiProvider;
  constructor(provider: A302aiProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const data = await this.provider.request<{ request_id: string; status: string }>({
      path: '/302/submit/pixverse-lipsync',
      method: 'POST',
      body: {
        video_url: params.video,
        audio_url: params.audio,
      },
    });
    if (!data.request_id) {
      throw new Error(data.status || 'Unknown error');
    }
    return data.request_id;
  }

  async getTaskResult(params: { model: string; taskId: string; params: z.infer<typeof paramsSchema> }): Promise<GenerationTaskResult> {
    const path = '/302/submit/pixverse-lipsync';
    const data = await this.provider.request<
      | { request_id: string; detail: string }
      | { request_id: string; status?: string; video: { url: string; content_type: string; file_size: number } }
    >({
      path,
      method: 'GET',
      query: { request_id: params.taskId },
    });

    if ('request_id' in data && 'detail' in data && data.detail === 'Request is still in progress') {
      return {
        status: 'processing',
      };
    }

    if ('status' in data && data.status !== 'COMPLETED') {
      console.error('Pixverse Lipsync failed', data);
      return {
        status: 'failed',
        error: data.status || 'Unknown error',
      };
    }

    if (!('video' in data)) {
      console.error('Pixverse Lipsync failed', data);
      return {
        status: 'failed',
        error: 'Unknown error',
      };
    }

    return {
      status: 'completed',
      data: [{ data: data.video.url, sourceType: 'url', type: 'video' }],
      usage: { video_count: 1 },
    };
  }

  /**
   * 精确计算成本（推荐使用此方法获得最准确的价格）
   * 使用真实的媒体文件元数据获取精确时长
   */
  async calculateCost(params: z.infer<typeof this.paramsSchema>, outputs: GenerationTaskResult): Promise<number> {
    // 价格定义 (厘/秒)
    const pricePerSec = 500;

    // 获取视频时长信息
    const videoDuration = await getMediaDuration((outputs.data?.[0]?.data as string) || '');

    const cost = pricePerSec * videoDuration;

    // 返回成本（以厘为单位）
    return cost;
  }
}
