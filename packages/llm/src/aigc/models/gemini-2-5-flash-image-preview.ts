import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { A302aiProvider } from '../providers/a302ai';
import { GenerationTaskResult, GenerationType } from '../types';

const paramsSchema = z.object({
  prompt: z.string(),
  referenceImage: z.array(z.string()).min(0).max(10).optional(),
});

/**
 * Gemini 2.5 Flash Image Preview
 * https://doc.302.ai/342037238e0
 */
export class Gemini25FlashImagePreview extends BaseAigcModel {
  name = 'gemini-2-5-flash-image-preview';
  displayName = 'Nano Banana';
  description = 'Nano Banana';
  costDescription = '0.5 Credits / image';
  generationTypes = ['text-to-image', 'image-to-image'] as GenerationType[];

  paramsSchema = paramsSchema;

  providerName = '302ai';
  provider: A302aiProvider;
  constructor(provider: A302aiProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const path = params.referenceImage?.length ? '/302/submit/gemini-2.5-flash-image-edit-async' : '/302/submit/gemini-2.5-flash-image-async';
    const data = await this.provider.request<{ request_id: string; status: string }>({
      path,
      method: 'POST',
      body: {
        prompt: params.prompt,
        image_urls: params.referenceImage,
      },
    });
    if (!data.request_id) {
      throw new Error(data.status);
    }
    return data.request_id;
  }

  async getTaskResult(params: { model: string; taskId: string; params: z.infer<typeof paramsSchema> }): Promise<GenerationTaskResult> {
    const path = '/302/submit/gemini-2.5-flash-image-async';
    const data = await this.provider.request<
      | { request_id: string; detail: string }
      | {
          images: { url: string; content_type: string }[];
        }
    >({ path, method: 'GET', query: { request_id: params.taskId } });

    if ('request_id' in data) {
      return {
        status: 'processing',
      };
    }

    if ('images' in data) {
      return {
        status: 'completed',
        data: data.images.map(image => ({ data: image.url, sourceType: 'url', type: 'image' })),
        usage: { image_count: data.images.length },
      };
    }

    throw new Error('Unknown error');
  }

  calculateCost(params: z.infer<typeof this.paramsSchema>): number {
    return 500;
  }
}
