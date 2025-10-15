import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { A302aiProvider } from '../providers/a302ai';
import { GenerationTaskResult, GenerationType } from '../types';
import { getMediaDuration } from '../utils/downloader';

const paramsSchema = z.object({
  firstFrame: z.string().optional(),
  audio: z.string(),
});

/**
 * Jimeng Omnihuman
 * https://doc.302.ai/357810967e0
 */
export class JimengOmnihuman extends BaseAigcModel {
  name = 'jimeng-omnihuman';
  displayName = 'Jimeng Omnihuman';
  description = '即梦同源数字人快速模型，根据单张图片+音频，生成该图片对应的视频效果。';
  costDescription = '1.5 Credits / second';
  generationTypes = ['image-to-video'] as GenerationType[];

  paramsSchema = paramsSchema;

  providerName = '302ai';
  provider: A302aiProvider;
  constructor(provider: A302aiProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const data = await this.provider.request<{
      code: number;
      data: {
        task_id: string;
      };
      message?: string;
    }>({
      path: '/doubao/omnihuman/video',
      method: 'POST',
      body: {
        image_url: params.firstFrame,
        audio_url: params.audio,
      },
    });
    if (data.code !== 10000 || !data.data.task_id) {
      throw new Error(data.message || 'Unknown error');
    }
    return data.data.task_id;
  }

  async getTaskResult(params: { model: string; taskId: string; params: z.infer<typeof paramsSchema> }): Promise<GenerationTaskResult> {
    const path = `/doubao/omnihuman/video_result`;
    const data = await this.provider.request<{
      status: number;
      data: {
        video_url: string;
        status: 'in_queue' | 'generating' | 'done' | 'not_found' | 'expired';
      };
      message?: string;
    }>({ path, method: 'POST', body: { task_id: params.taskId } });

    const status = this.getStatus(data.data?.status || 'in_queue');

    if (status !== 'completed') {
      return {
        status,
      };
    }

    return {
      status,
      data: [{ data: data.data?.video_url, sourceType: 'url', type: 'video' }],
      usage: {
        video_count: 1,
      },
    };
  }

  private getStatus(status: 'in_queue' | 'generating' | 'done' | 'not_found' | 'expired'): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (status) {
      case 'in_queue':
        return 'pending';
      case 'generating':
        return 'processing';
      case 'done':
        return 'completed';
      case 'not_found':
        return 'failed';
      case 'expired':
        return 'failed';
      default:
        return 'failed';
    }
  }

  async calculateCost(params: z.infer<typeof this.paramsSchema>): Promise<number> {
    const duration = await getMediaDuration(params.audio);
    return 1500 * duration;
  }
}
