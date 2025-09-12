import z from 'zod';
import { ToAsyncTaskManager } from '../../utils/to-async-task';
import { BaseAigcModel } from '../core/base-model';
import { seedream40ParamsSchema, VolcengineArkProvider } from '../providers/volcengine-ark';
import { GenerationTaskResult, GenerationType } from '../types';

const toAsync = new ToAsyncTaskManager<Awaited<ReturnType<VolcengineArkProvider['seedream40']>>>();

/**
 * https://www.volcengine.com/docs/82379/1666946
 */
export class DoubaoSeedream40 extends BaseAigcModel {
  name = 'doubao-seedream-4-0-250828';
  displayName = '豆包4.0';
  description = '4k超高清直出，超强主体一致性，支持多参考图、组图生成';
  parameterLimits = {
    generationType: ['image-to-image', 'text-to-image'] as GenerationType[],
  };

  paramsSchema = z.object({
    prompt: z.string().describe('[title:提示词][renderType:textarea]'),
    image: z.array(z.string()).describe('[title:参考图][renderType:imageArray]').min(1).max(10).optional(),
    aspectRatio: z.enum(['16:9', '4:3', '9:16', '3:4', '3:2', '2:3', '1:1', '21:9']).describe('[title:画面比例][renderType:ratio]'),
    sequential_image_generation: z.boolean().default(false).describe('[title:组图模式]'),
    sequential_image_generation_options: z
      .object({
        max_images: z.number().min(1).max(15).default(15).optional().describe('[title:最大图片数量]'),
      })
      .optional()
      .describe('[title:组图设置][showWhen:sequential_image_generation=true]'),
  });

  provider: VolcengineArkProvider;
  constructor(provider: VolcengineArkProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const size = this.convertAspectRatioToImageSize(params.aspectRatio);
    const task = toAsync.addTask(
      this.provider.seedream40({
        model: 'doubao-seedream-4-0-250828',
        prompt: params.prompt,
        image: params.image,
        sequential_image_generation: params.sequential_image_generation ? 'auto' : 'disabled',
        sequential_image_generation_options: params.sequential_image_generation_options,
        size: size as z.infer<typeof seedream40ParamsSchema>['size'],
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
      data: result.result?.data?.map(item => ({ url: item.url, type: 'image' })) || [],
      usage: { image_count: result.result?.data?.length || 0 },
      error: result.error || undefined,
    };
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
