import { BaseAigcModel, KeyframeToVideoParams } from '../core/base-model';
import { DashscopeWanProvider, kf2vGetResultParamsSchema, kf2vSubmitParamsSchema } from '../providers/aliyun-dashscope';
import { GenerationTaskResult, GenerationType } from '../types';

/**
 * 万相2.1 首尾帧生视频模型
 * https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2880649
 */
export class Wanx21Kf2vPlus extends BaseAigcModel {
  name = 'wanx2.1-kf2v-plus';
  displayName = '万相 2.1 首尾帧生视频';
  description = '首尾帧生视频模型';
  parameterLimits = {
    aspectRatio: ['1:1', '16:9', '9:16'],
    generationType: ['keyframe-to-video'] as GenerationType[],
  };

  submitParamsSchema = kf2vSubmitParamsSchema;

  provider: DashscopeWanProvider;
  constructor(provider: DashscopeWanProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: KeyframeToVideoParams): Promise<string> {
    const parsed = this.submitParamsSchema.safeParse({
      model: 'wanx2.1-kf2v-plus',
      input: {
        first_frame_url: params.firstFrame,
        last_frame_url: params.lastFrame,
        prompt: params.prompt,
      },
      parameters: {
        resolution: undefined,
        duration: params.duration,
      },
    });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.kf2vSubmit(parsed.data);
    return result.output.task_id;
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const parsed = kf2vGetResultParamsSchema.safeParse({ task_id: params.taskId });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.kf2vGetResult(parsed.data);
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
}
