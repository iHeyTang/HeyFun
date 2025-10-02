import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { A302aiProvider } from '../providers/a302ai';
import { GenerationTaskResult, GenerationType } from '../types';

const paramsSchema = z.object({
  prompt: z.string(),
  referenceImage: z.array(z.string()).min(0).max(10).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1']),
  advanced: z.object({
    image_fidelity: z.number().min(0).max(1).step(0.1).optional(),
    human_fidelity: z.number().min(0).max(1).step(0.1).optional(),
  }),
});

/**
 * Kling 2.1
 * https://doc.302.ai/api-322183267
 * TODO: 多参考图需要额外的接口(开发中) 目前仅支持单个参考图，若传入多参考图，只会使用第一个参考图
 */
export class Kling21 extends BaseAigcModel {
  name = 'kling-2-1';
  displayName = 'Kling 2.1';
  description = 'Kling 2.1';
  costDescription = '0.35 Credits / image';
  generationTypes = ['text-to-image', 'image-to-image'] as GenerationType[];

  paramsSchema = paramsSchema;

  provider: A302aiProvider;
  constructor(provider: A302aiProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const modelName = this.detectModelName(params);
    const data = await this.provider.request<{ code: number; data: { task_id: string; task_status: string }; message: string }>({
      path: '/klingai/v1/images/generations',
      method: 'POST',
      body: {
        model_name: modelName,
        prompt: params.prompt,
        image: params.referenceImage?.[0],
        image_fidelity: params.advanced?.image_fidelity || 0.5,
        human_fidelity: params.advanced?.human_fidelity || 0.5,
        n: 1,
        aspect_ratio: params.aspectRatio,
      },
    });
    if (data.code !== 0) {
      throw new Error(data.message);
    }
    return data.data.task_id;
  }

  async getTaskResult(params: { model: string; taskId: string; params: z.infer<typeof paramsSchema> }): Promise<GenerationTaskResult> {
    const path = `/klingai/v1/images/generations/${params.taskId}`;
    const data = await this.provider.request<{
      code: number;
      data?: {
        task_id: string;
        task_result?: { images: { url: string }[] };
        task_status: 'succeed' | 'submitted';
        task_status_msg: string;
      };
      message?: string;
    }>({ path, method: 'GET' });
    if (!data.data?.task_id) {
      throw new Error(data.message || 'Unknown error');
    }
    console.log(data.data.task_status);
    const status = this.getStatus(data.data?.task_status || 'submitted');

    if (status !== 'completed') {
      return {
        status,
      };
    }

    return {
      status,
      data: data.data.task_result?.images?.map(url => ({ data: url.url, sourceType: 'url', type: 'image' })) || [],
      usage: {
        image_count: data.data.task_result?.images?.length || 0,
      },
    };
  }

  /**
   * v2版本支持单个参考图，v2.1只支持文生图，多参考图需要额外的接口(开发中) 目前仅支持单个参考图，若传入多参考图，只会使用第一个参考图
   * @param params
   * @returns
   */
  private detectModelName(params: z.infer<typeof this.paramsSchema>): string {
    if (params.referenceImage?.length) {
      return 'kling-v2';
    }
    return 'kling-v2-1';
  }

  private getStatus(status: 'succeed' | 'submitted'): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (status) {
      case 'succeed':
        return 'completed';
      case 'submitted':
        return 'processing';
      default:
        return 'failed';
    }
  }

  calculateCost(params: z.infer<typeof this.paramsSchema>): number {
    return 0.35;
  }
}
