import { BaseAigcModel, ImageToVideoParams } from '../core/base-model';
import {
  jimengi2vS20ProGetResultParamsSchema,
  jimengi2vS20ProParamsSchema,
  VolcengineJimengProvider,
  volcengineJimengServiceConfigSchema,
} from '../providers/volcengine-jimeng';
import { GenerationTaskResult, GenerationType } from '../types';
import { downloadFile } from '../utils/downloader';

/**
 * 即梦图生视频S2.0 Pro模型
 * https://www.volcengine.com/docs/85621/1616429
 */
export class JimengVgfmI2vL20 extends BaseAigcModel {
  name = 'jimeng-vgfm-i2v-l20';
  displayName = '即梦 图生视频 S2.0 Pro(图生视频)';
  description = '专业图生视频模型';
  parameterLimits = {
    aspectRatio: [],
    generationType: ['image-to-video'] as GenerationType[],
  };

  submitParamsSchema = jimengi2vS20ProParamsSchema;

  provider: VolcengineJimengProvider;
  constructor(provider: VolcengineJimengProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: ImageToVideoParams): Promise<string> {
    const buffer = await downloadFile(params.referenceImage);
    const parsed = this.submitParamsSchema.safeParse({
      req_key: 'jimeng_vgfm_i2v_l20',
      prompt: params.prompt,
      seed: -1, // 使用默认种子
      aspect_ratio: params.aspectRatio,
      binary_data_base64: [buffer.toString('base64')],
    });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.i2vS20Pro(parsed.data);
    return result.data.task_id;
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const parsed = jimengi2vS20ProGetResultParamsSchema.safeParse({
      task_id: params.taskId,
      req_key: 'jimeng_vgfm_i2v_l20',
    });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.i2vS20ProGetResult(parsed.data);
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
