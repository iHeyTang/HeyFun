import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { A302aiProvider } from '../providers/a302ai';
import { GenerationTaskResult, GenerationType } from '../types';
import { downloadFile } from '../utils/downloader';

const MODEL_MAP = {
  relax: 'mj-relax',
  fast: 'mj',
  turbo: 'mj-turbo',
};

const paramsSchema = z.object({
  prompt: z.string(),
  referenceImage: z.array(z.string()).min(0).max(10).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1']),
  n: z.enum(['4']).optional(),
  advanced: z.object({
    mode: z.enum(['relax', 'fast', 'turbo']).describe('[title:Mode]'),
  }),
});

/**
 * Midjourney V7
 * https://doc.302.ai/235701263e0
 */
export class MidjourneyV7 extends BaseAigcModel {
  name = 'midjourney-v7';
  displayName = 'Midjourney V7';
  description = 'Midjourney V7';
  costDescription = '0.5 Credits / 4 images';
  generationTypes = ['text-to-image', 'image-to-image'] as GenerationType[];

  paramsSchema = paramsSchema;

  providerName = '302ai';
  provider: A302aiProvider;
  constructor(provider: A302aiProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const path = `/${MODEL_MAP[params.advanced?.mode] || 'mj'}/submit/imagine`;

    const base64Array = await Promise.all(
      params.referenceImage?.map(async image => {
        return downloadFile(image).then(file => {
          return file.toString('base64');
        });
      }) || [],
    );

    const data = await this.provider.request<{ code: 1 | 22 | number; description: string; properties: object; result: string }>({
      path: path,
      method: 'POST',
      body: {
        base64Array,
        prompt: `${params.prompt} --ar ${params.aspectRatio}`,
        botType: 'mj',
      },
    });
    if (data.code !== 1 && data.code !== 22) {
      throw new Error(data.description);
    }
    return data.result;
  }

  async getTaskResult(params: { model: string; taskId: string; params: z.infer<typeof paramsSchema> }): Promise<GenerationTaskResult> {
    const mode = params.params.advanced?.mode;
    const path = `/${MODEL_MAP[mode] || 'mj'}/task/${params.taskId}/fetch`;
    const data = await this.provider.request<{
      action?: 'IMAGINE';
      botType?: string;
      buttons?: { customId?: string; emoji?: string; label?: string; style?: number; type?: number }[];
      description?: string;
      failReason?: string;
      finishTime: number;
      id?: string;
      imageUrl?: string;
      imageUrls?: { url: string }[];
      progress: `${string}%`;
      prompt?: string;
      promptEn?: string;
      properties?: object;
      startTime?: number;
      state?: string;
      status?: 'NOT_START' | 'SUBMITTED' | 'MODAL' | 'IN_PROGRESS' | 'FAILURE' | 'SUCCESS' | 'CANCEL';
      submittedTime?: number;
    }>({ path, method: 'GET' });
    if (!data.id) {
      throw new Error(data.failReason || data.description || 'Unknown error');
    }

    const status = this.getStatus(data.status || 'NOT_START');

    if (status === 'failed') {
      return {
        status,
        error: data.failReason || data.description || 'Unknown error',
      };
    }

    if (status !== 'completed') {
      return {
        status,
      };
    }

    return {
      status,
      data: data.imageUrls?.map(url => ({ data: url.url, sourceType: 'url', type: 'image' })) || [],
      usage: {
        image_count: data.imageUrls?.length || 0,
      },
    };
  }

  private getStatus(
    status: 'NOT_START' | 'SUBMITTED' | 'MODAL' | 'IN_PROGRESS' | 'FAILURE' | 'SUCCESS' | 'CANCEL',
  ): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (status) {
      case 'NOT_START':
        return 'pending';
      case 'SUBMITTED':
      case 'MODAL':
      case 'IN_PROGRESS':
        return 'processing';
      case 'SUCCESS':
        return 'completed';
      case 'FAILURE':
      case 'CANCEL':
      default:
        return 'failed';
    }
  }

  calculateCost(params: z.infer<typeof this.paramsSchema>): number {
    return 500;
  }
}
