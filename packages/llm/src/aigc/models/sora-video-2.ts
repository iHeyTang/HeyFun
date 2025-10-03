import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { A302aiProvider } from '../providers/a302ai';
import { GenerationTaskResult, GenerationType } from '../types';

const paramsSchema = z.object({
  prompt: z.string(),
});

/**
 * Sora 2
 * https://doc.302.ai/api-322183267
 */
export class SoraVideo2 extends BaseAigcModel {
  name = 'sora-video-2';
  displayName = 'Sora 2';
  description = 'Sora 2';
  costDescription = '0 Credits / image';
  generationTypes = ['text-to-video'] as GenerationType[];

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
        id: string;
        status: string;
      };
      message?: string;
    }>({
      path: '/sora/v2/video',
      method: 'POST',
      body: {
        model: 'sora-2',
        orientation: undefined,
        prompt: params.prompt,
      },
    });
    if (data.code !== 200 || !data.data.id) {
      throw new Error(data.message || 'Unknown error');
    }
    return data.data.id;
  }

  async getTaskResult(params: { model: string; taskId: string; params: z.infer<typeof paramsSchema> }): Promise<GenerationTaskResult> {
    const path = `/sora/v2/video/${params.taskId}`;
    const data = await this.provider.request<{
      code: number;
      data?: {
        id: string;
        status: 'processing' | 'completed';
        outputs: string[];
      };
      message?: string;
    }>({ path, method: 'GET' });

    const status = this.getStatus(data.data?.status || 'processing');

    if (status !== 'completed') {
      return {
        status,
      };
    }

    return {
      status,
      data: data.data?.outputs?.map(url => ({ data: url, sourceType: 'url', type: 'video' })) || [],
      usage: {
        video_count: data.data?.outputs?.length || 0,
      },
    };
  }

  private getStatus(status: 'created' | 'processing' | 'completed'): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (status) {
      case 'created':
        return 'pending';
      case 'completed':
        return 'completed';
      case 'processing':
        return 'processing';
      default:
        return 'failed';
    }
  }

  calculateCost(params: z.infer<typeof this.paramsSchema>): number {
    return 0;
  }
}
