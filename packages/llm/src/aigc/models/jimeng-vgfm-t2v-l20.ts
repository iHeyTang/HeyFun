import { BaseAigcModel, TextToVideoParams } from '../core/base-model';
import { jimengt2vS20ProGetResultParamsSchema, jimengt2vS20ProParamsSchema, VolcengineJimengProvider } from '../providers/volcengine-jimeng';
import { GenerationTaskResult, GenerationType } from '../types';

/**
 * 即梦文生视频S2.0 Pro模型
 * https://www.volcengine.com/docs/85621/1616429
 */
export class JimengVgfmT2vL20 extends BaseAigcModel {
  name = 'jimeng-vgfm-t2v-l20';
  displayName = '即梦 文生视频 S2.0 Pro(文生视频)';
  description = '专业文生视频模型';
  parameterLimits = {
    aspectRatio: ['16:9', '9:16', '4:3', '3:4', '21:9'],
    generationType: ['text-to-video'] as GenerationType[],
  };

  submitParamsSchema = jimengt2vS20ProParamsSchema;

  provider: VolcengineJimengProvider;
  constructor(provider: VolcengineJimengProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: TextToVideoParams): Promise<string> {
    const parsed = this.submitParamsSchema.safeParse({
      req_key: 'jimeng_vgfm_t2v_l20',
      prompt: params.prompt,
      seed: -1, // 使用默认种子
      aspect_ratio: params.aspectRatio,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.t2vS20Pro(parsed.data);
    return result.data.task_id;
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const parsed = jimengt2vS20ProGetResultParamsSchema.safeParse({
      task_id: params.taskId,
      req_key: 'jimeng_vgfm_t2v_l20',
    });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.t2vS20ProGetResult(parsed.data);
    return {
      status: this.getStatus(result.data.status),
      data: [{ url: result.data.video_url, type: 'video' }],
      usage: {
        video_duration: 5,
        video_count: 1,
      },
    };
  }

  private getStatus(status: 'in_queue' | 'generating' | 'done' | 'not_found' | 'expired'): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (status) {
      case 'in_queue':
        return 'pending';
      case 'generating':
        return 'processing';
      case 'done':
        return 'completed';
      case 'not_found':
        return 'failed';
      case 'expired':
        return 'failed';
      default:
        return 'failed';
    }
  }
}
