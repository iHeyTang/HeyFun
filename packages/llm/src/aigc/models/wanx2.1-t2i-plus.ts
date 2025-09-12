import { BaseAigcModel, TextToImageParams } from '../core/base-model';
import { DashscopeWanProvider, t2iGetResultParamsSchema, t2iSubmitParamsSchema } from '../providers/aliyun-dashscope';
import { GenerationTaskResult, GenerationType } from '../types';

/**
 * 万相2.1 T2I Plus模型
 * https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2862677
 */
export class Wanx21T2iPlus extends BaseAigcModel {
  name = 'wanx2.1-t2i-plus';
  displayName = '万相 2.1 Plus(文生图)';
  description = '高质量文生图模型';
  parameterLimits = {
    aspectRatio: ['1:1', '16:9', '4:3', '9:16', '3:4'],
    generationType: ['text-to-image'] as GenerationType[],
  };

  submitParamsSchema = t2iSubmitParamsSchema;

  provider: DashscopeWanProvider;
  constructor(provider: DashscopeWanProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: TextToImageParams): Promise<string> {
    const parsed = this.submitParamsSchema.safeParse({
      model: 'wanx2.1-t2i-plus',
      input: {
        prompt: params.prompt,
      },
      parameters: {
        size: this.convertAspectRatioToImageSize(params.aspectRatio),
        n: 1,
        seed: 0,
        prompt_extend: true,
        watermark: false,
      },
    });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.t2iSubmit(parsed.data);
    return result.output.task_id;
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const parsed = t2iGetResultParamsSchema.safeParse({ task_id: params.taskId });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.t2iGetResult(parsed.data);
    return {
      status: this.getStatus(result.output.task_status),
      data: result.output.results?.map(item => ({ url: item.url, type: 'image' })) || [],
      usage: result.usage,
      error: result.output.task_status === 'FAILED' ? `[${result.output.code}] ${result.output.message}` || 'Task failed' : undefined,
    };
  }

  private getStatus(
    status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN',
  ): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (status) {
      case 'PENDING':
        return 'pending';
      case 'RUNNING':
        return 'processing';
      case 'SUCCEEDED':
        return 'completed';
      case 'FAILED':
        return 'failed';
      case 'CANCELED':
        return 'failed';
      case 'UNKNOWN':
        return 'failed';
      default:
        return 'failed';
    }
  }

  /**
   * 将宽高比转换为尺寸
   * 图像宽高边长的像素范围为：[512, 1440]，单位像素。可任意组合以设置不同的图像分辨率，最高可达200万像素。
   * @see https://bailian.console.aliyun.com/?spm=5176.30371578.J_wilqAZEFYRJvCsnM5_P7j.1.e939154aMDld0n&tab=api&scm=20140722.M_10875430.P_126.MO_3931-ID_10875430-MID_10875430-CID_34338-ST_14391-V_1#/api/?type=model&url=2862677
   * @param aspectRatio 宽高比
   * @returns 尺寸
   */
  private convertAspectRatioToImageSize(aspectRatio: string): string | undefined {
    switch (aspectRatio) {
      case '9:16':
        return '810*1440';
      case '16:9':
        return '1440*810';
      case '4:3':
        return '1440*1080';
      case '3:4':
        return '1080*1440';
      case '1:1':
        return '1024*1024';
      default:
        return undefined;
    }
  }
}
