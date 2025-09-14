import z from 'zod';
import { ToAsyncTaskManager } from '../../utils/to-async-task';
import { BaseAigcModel } from '../core/base-model';
import { VolcengineArkProvider } from '../providers/volcengine-ark';
import { GenerationTaskResult, GenerationType } from '../types';

const toAsync = new ToAsyncTaskManager<Awaited<ReturnType<VolcengineArkProvider['seedEdit30I2i']>>>();

/**
 * https://www.volcengine.com/docs/82379/1666946
 */
export class DoubaoSeededit30I2i250628 extends BaseAigcModel {
  name = 'doubao-seededit-3-0-i2i-250628';
  displayName = '豆包图片编辑 3.0';
  description = '准确遵循编辑指令，有效保留图像内容';
  costDescription = '0.33 Credits / image';
  generationTypes = ['image-to-image'] as GenerationType[];

  paramsSchema = z.object({
    prompt: z.string().describe('[title:提示词][renderType:textarea]'),
    image: z.string().describe('[title:参考图片][renderType:image]'),
    guidance_scale: z.number().min(1).max(10).step(0.1).default(5.5).optional().describe('[title:提示词引导强度]'),
  });

  provider: VolcengineArkProvider;
  constructor(provider: VolcengineArkProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const task = toAsync.addTask(
      this.provider.seedEdit30I2i({
        model: 'doubao-seededit-3-0-i2i-250628',
        prompt: params.prompt,
        image: params.image,
        guidance_scale: params.guidance_scale,
        size: 'adaptive',
        seed: -1,
        response_format: 'url',
        watermark: false,
      }),
    );
    return task.id;
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const result = toAsync.getTask(params.taskId);
    if (!result) {
      throw new Error('Task not found');
    }
    return {
      status: result.status === 'succeeded' ? 'completed' : result.status === 'failed' ? 'failed' : 'pending',
      data: result.result?.data?.map(item => ({ data: item.url, sourceType: 'url', type: 'image' })) || [],
      usage: { image_count: result.result?.data?.length || 0 },
      error: result.error || undefined,
    };
  }

  calculateCost(params: z.infer<typeof this.paramsSchema>): number {
    return 330;
  }
}
