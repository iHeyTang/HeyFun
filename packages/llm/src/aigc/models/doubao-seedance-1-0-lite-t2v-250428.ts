import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { seedance10ProSubmitParamsSchema, VolcengineArkProvider } from '../providers/volcengine-ark';
import { GenerationTaskResult, GenerationType } from '../types';

/**
 * https://www.volcengine.com/docs/82379/1520757
 */
export class DoubaoSeedance10LiteT2v250428 extends BaseAigcModel {
  name = 'doubao-seedance-1-0-lite-t2v-250428';
  displayName = '豆包1.0 Lite(文生视频)';
  description = '精准响应，性价比高';
  parameterLimits = {
    aspectRatio: ['16:9', '4:3', '9:16', '3:4', '3:2', '2:3', '1:1', '21:9'],
    generationType: ['text-to-video'] as GenerationType[],
  };

  paramsSchema = z.object({
    prompt: z.string().describe('[title:提示词][renderType:textarea]'),
    aspectRatio: z.enum(['16:9', '4:3', '9:16', '3:4', '3:2', '2:3', '1:1', '21:9']).describe('[title:画面比例][renderType:ratio]'),
    duration: z.number().min(3).max(12).default(5).describe('[title:视频时长(秒)][unit:s]'),
    camerafixed: z.boolean().default(false).describe('[title:固定镜头]'),
  });

  provider: VolcengineArkProvider;
  constructor(provider: VolcengineArkProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const size = this.convertAspectRatioToImageSize(params.aspectRatio);

    const task = await this.provider.seedanceSubmit({
      model: 'doubao-seedance-1-0-lite-t2v-250428',
      content: [
        { type: 'text', text: params.prompt },
        { type: 'text', text: `--rt ${size} --dur ${params.duration} --fps 24 --wm false --seed -1 --cf ${params.camerafixed}` },
      ],
    });
    return task.id;
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const result = await this.provider.seedanceGetResult({ id: params.taskId });
    if (!result) {
      throw new Error('Task not found');
    }
    return {
      status: result.status === 'succeeded' ? 'completed' : result.status === 'failed' ? 'failed' : 'pending',
      data: result.content?.video_url ? [{ url: result.content.video_url, type: 'video' }] : [],
      usage: { video_count: result.content?.video_url ? 1 : 0 },
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
