import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { DashscopeWanProvider, t2vGetResultParamsSchema } from '../providers/aliyun-dashscope';
import { GenerationTaskResult, GenerationType } from '../types';

/**
 * 万相2.1 T2V Turbo模型
 * https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2865250
 */
export class Wanx21T2vTurbo extends BaseAigcModel {
  name = 'wanx2.1-t2v-turbo';
  displayName = '万相 2.1 Turbo(文生视频)';
  description = '快速文生视频模型';
  parameterLimits = {
    aspectRatio: ['1:1', '16:9', '9:16'],
    duration: [5],
    generationType: ['text-to-video'] as GenerationType[],
  };

  paramsSchema = z.object({
    prompt: z.string().describe('[title:提示词][renderType:textarea]'),
    aspectRatio: z.enum(['1:1', '16:9', '9:16']).describe('[title:画面比例][renderType:ratio]'),
    duration: z.number().min(5).max(5).default(5).describe('[title:视频时长(秒)][unit:s]'),
  });

  provider: DashscopeWanProvider;
  constructor(provider: DashscopeWanProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const result = await this.provider.t2vSubmit({
      model: 'wanx2.1-t2v-turbo',
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
   * wanx2.1-t2v-turbo：支持 480P 和 720P 对应的所有分辨率。默认分辨率为1280*720（720P）。
   * @see https://bailian.console.aliyun.com/?spm=5176.30371578.J_wilqAZEFYRJvCsnM5_P7j.1.e939154aMDld0n&tab=api&scm=20140722.M_10875430.P_126.MO_3931-ID_10875430-MID_10875430-CID_34338-ST_14391-V_1#/api/?type=model&url=2865250
   * @param aspectRatio 宽高比
   * @returns 分辨率
   */
  private convertAspectRatioToVideoSize(aspectRatio: string): string | undefined {
    const sizeMap: Record<string, string> = {
      '9:16': '720*1280',
      '16:9': '1280*720',
      '4:3': '1088*832',
      '3:4': '832*1088',
      '1:1': '960*960',
    };

    return sizeMap[aspectRatio];
  }
}
