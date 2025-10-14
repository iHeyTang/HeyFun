import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { A302aiProvider } from '../providers/a302ai';
import { GenerationTaskResult, GenerationType } from '../types';

const paramsSchema = z.object({
  prompt: z.string(),
  referenceImage: z.array(z.string()).min(0).max(10).optional(),
  n: z.enum(['1', '2', '4']).optional(),
});

/**
 * Gemini 2.5 Flash Image
 * https://doc.302.ai/342037238e0
 */
export class Gemini25FlashImage extends BaseAigcModel {
  name = 'gemini-2-5-flash-image';
  displayName = 'Gemini Nano Banana';
  description = 'Gemini Nano Banana';
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

    // 根据 n 参数确定需要生成的数量
    const count = params.n ? parseInt(params.n) : 1;
    const requestIds: string[] = [];

    // 提交多个任务
    for (let i = 0; i < count; i++) {
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
      requestIds.push(data.request_id);
    }

    // 用逗号分隔多个 request_id
    return requestIds.join(',');
  }

  async getTaskResult(params: { model: string; taskId: string; params: z.infer<typeof paramsSchema> }): Promise<GenerationTaskResult> {
    const path = '/302/submit/gemini-2.5-flash-image-async';

    // 解析多个 taskId（用逗号分隔）
    const taskIds = params.taskId.split(',');
    const results: Array<{ url: string; content_type: string }> = [];
    const errors: string[] = [];
    let hasProcessing = false;

    // 查询所有任务的状态
    for (const taskId of taskIds) {
      try {
        const data = await this.provider.request<{ request_id?: string; detail?: string; images?: { url: string; content_type: string }[] }>({
          path,
          method: 'GET',
          query: { request_id: taskId },
        });

        if ('request_id' in data) {
          // 有任务还在处理中
          hasProcessing = true;
        } else if ('images' in data && data.images) {
          // 收集完成的结果
          results.push(...data.images);
        } else {
          // 未知响应格式，记录错误但继续处理其他任务
          errors.push(`Task ${taskId}: Unknown response format`);
        }
      } catch (error) {
        // 捕获单个任务的错误，记录后继续处理其他任务
        errors.push(`Task ${taskId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 如果还有任务在处理中，返回处理中状态
    if (hasProcessing) {
      return {
        status: 'processing',
      };
    }

    // 如果所有任务都失败了，抛出错误
    if (results.length === 0 && errors.length > 0) {
      throw new Error(`All tasks failed:\n${errors.join('\n')}`);
    }

    // 返回成功的结果（即使部分任务失败）
    return {
      status: 'completed',
      data: results.map(image => ({ data: image.url, sourceType: 'url', type: 'image' })),
      usage: { image_count: results.length },
    };
  }

  calculateCost(params: z.infer<typeof this.paramsSchema>): number {
    const count = params.n ? parseInt(params.n) : 1;
    return 500 * count;
  }
}
