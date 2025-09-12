import { BaseAigcModel, TextToVideoParams } from '../core/base-model';
import { DashscopeWanProvider, t2vGetResultParamsSchema, t2vSubmitParamsSchema } from '../providers/aliyun-dashscope';
import { dashscopeWanServiceConfigSchema } from '../providers/aliyun-dashscope';
import { GenerationTaskResult, GenerationType } from '../types';
import z from 'zod';

/**
 * 万相T2V Plus模型
 * https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2865250
 */
export class Wan22T2vPlus extends BaseAigcModel {
  name = 'wan2.2-t2v-plus';
  displayName = '万相 2.2 Plus(文生视频)';
  description = '高质量文生视频模型';
  parameterLimits = {
    aspectRatio: ['1:1', '16:9', '9:16'],
    duration: [5],
    generationType: ['text-to-video'] as GenerationType[],
  };

  submitParamsSchema = t2vSubmitParamsSchema;

  provider: DashscopeWanProvider;
  constructor(provider: DashscopeWanProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: TextToVideoParams): Promise<string> {
    const parsed = this.submitParamsSchema.safeParse({
      model: 'wan2.2-t2v-plus',
      input: {
        prompt: params.prompt,
      },
      parameters: {
        size: this.convertAspectRatioToVideoSize(params.aspectRatio),
        duration: params.duration,
        prompt_extend: true,
        seed: 0,
        watermark: false,
      },
    });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.t2vSubmit(parsed.data);
    return result.output.task_id;
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const parsed = t2vGetResultParamsSchema.safeParse({ task_id: params.taskId });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.t2vGetResult(parsed.data);
    return {
      status: this.getStatus(result.output.task_status),
      data: [{ url: result.output.video_url, type: 'video' }],
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
   * 根据传入的宽高比和对应模型支持的最大resolution，计算出最接近的分辨率
   * wan2.2-t2v-plus：支持480P和1080P对应的所有分辨率。默认分辨率为1920*1080（1080P）。
   * @see https://bailian.console.aliyun.com/?spm=5176.30371578.J_wilqAZEFYRJvCsnM5_P7j.1.e939154aMDld0n&tab=api&scm=20140722.M_10875430.P_126.MO_3931-ID_10875430-MID_10875430-CID_34338-ST_14391-V_1#/api/?type=model&url=2865250
   * @param aspectRatio 宽高比
   * @returns 分辨率
   */
  private convertAspectRatioToVideoSize(aspectRatio: string): string | undefined {
    const sizeMap: Record<string, string> = {
      '9:16': '1080*1920',
      '16:9': '1920*1080',
      '4:3': '1632*1248',
      '3:4': '1248*1632',
      '1:1': '1440*1440',
    };

    return sizeMap[aspectRatio];
  }
}
