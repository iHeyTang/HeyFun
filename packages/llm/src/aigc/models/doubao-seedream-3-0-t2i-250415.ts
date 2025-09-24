import z from 'zod';
import { ToAsyncTaskManager } from '../../utils/to-async-task';
import { BaseAigcModel } from '../core/base-model';
import { seedream30T2iParamsSchema, VolcengineArkProvider } from '../providers/volcengine-ark';
import { GenerationTaskResult, GenerationType } from '../types';

const toAsync = new ToAsyncTaskManager<Awaited<ReturnType<VolcengineArkProvider['seedream30T2i']>>>();

/**
 * https://www.volcengine.com/docs/82379/1541523
 */
export class DoubaoSeedream30T2i250415 extends BaseAigcModel {
  name = 'doubao-seedream-3-0-t2i-250415';
  displayName = '豆包文生图 3.0';
  description = '影视质感，文字更准，直出 2K 高清图';
  costDescription = '0.285 Credits / image';
  generationTypes = ['text-to-image'] as GenerationType[];

  paramsSchema = z.object({
    prompt: z.string(),
    aspectRatio: z.enum(['16:9', '4:3', '9:16', '3:4', '3:2', '2:3', '1:1', '21:9']),
    referenceImage: z.undefined().optional(),
    advanced: z.object({
      guidance_scale: z.number().min(1).max(10).default(2.5).optional().describe('[title:提示词引导强度]'),
    }),
  });

  provider: VolcengineArkProvider;
  constructor(provider: VolcengineArkProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const size = this.convertAspectRatioToImageSize(params.aspectRatio);
    const task = toAsync.addTask(
      this.provider.seedream30T2i({
        model: 'doubao-seedream-3-0-t2i-250415',
        prompt: params.prompt,
        guidance_scale: params.advanced.guidance_scale,
        size: size as z.infer<typeof seedream30T2iParamsSchema>['size'],
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
    return 285;
  }

  /**
   * 1024x1024 （1:1）
   * 864x1152 （3:4）
   * 1152x864 （4:3）
   * 1280x720 （16:9）
   * 720x1280 （9:16）
   * 832x1248 （2:3）
   * 1248x832 （3:2）
   * 1512x648 （21:9）
   *
   * @see https://www.volcengine.com/docs/82379/1541523
   * @param model
   * @param aspectRatio
   * @returns
   */
  private convertAspectRatioToImageSize(aspectRatio: string): `${number}x${number}` | undefined {
    switch (aspectRatio) {
      case '1:1':
        return '1024x1024';
      case '4:3':
        return '1152x864';
      case '3:4':
        return '864x1152';
      case '16:9':
        return '1280x720';
      case '9:16':
        return '720x1280';
      case '2:3':
        return '832x1248';
      case '3:2':
        return '1248x832';
      case '21:9':
        return '1512x648';
      default:
        return undefined;
    }
  }
}
