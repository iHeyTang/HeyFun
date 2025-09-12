import { BaseAigcModel, ImageToImageParams } from '../core/base-model';
import {
  jimengI2iV30GetResultParamsSchema,
  jimengI2iV30SubmitParamsSchema,
  VolcengineJimengProvider,
  volcengineJimengServiceConfigSchema,
} from '../providers/volcengine-jimeng';
import { GenerationTaskResult, GenerationType } from '../types';
import { downloadFile } from '../utils/downloader';

/**
 * 即梦图生图3.0模型
 * https://www.volcengine.com/docs/85621/1616429
 */
export class JimengI2iV30 extends BaseAigcModel {
  name = 'jimeng-i2i-v30';
  displayName = '即梦 图生图 3.0';
  description = '高质量图生图模型';
  parameterLimits = {
    aspectRatio: ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1', '21:9'],
    generationType: ['image-to-image'] as GenerationType[],
  };

  submitParamsSchema = jimengI2iV30SubmitParamsSchema;

  provider: VolcengineJimengProvider;
  constructor(provider: VolcengineJimengProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: ImageToImageParams): Promise<string> {
    const size = this.convertAspectRatioToImageSize(params.aspectRatio);
    const buffer = await downloadFile(params.referenceImage);
    const parsed = this.submitParamsSchema.safeParse({
      req_key: 'jimeng_i2i_v30',
      prompt: params.prompt,
      seed: -1, // 使用默认种子
      width: size?.width,
      height: size?.height,
      scale: 0.5, // 默认缩放比例
      binary_data_base64: [buffer.toString('base64')],
    });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.i2iV30Submit(parsed.data);
    return result.data.task_id;
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const parsed = jimengI2iV30GetResultParamsSchema.safeParse({
      task_id: params.taskId,
      req_key: 'jimeng_i2i_v30',
      req_json: { return_url: true },
    });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.i2iV30GetResult(parsed.data);
    return {
      status: this.getStatus(result.data.status),
      data: result.data.image_urls?.map(url => ({ url, type: 'image' })) || [],
      usage: {
        image_count: result.data.image_urls?.length || 0,
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

  /**
   * 转换宽高比为图片尺寸
   * 1328 * 1328（1:1）
   * 1472 * 1104 （4:3）
   * 1584 * 1056（3:2）
   * 1664 * 936（16:9）
   * 2016 * 864（21:9）
   * @see https://www.volcengine.com/docs/85621/1616429
   * @param aspectRatio 宽高比
   * @returns 尺寸
   */
  private convertAspectRatioToImageSize(aspectRatio: string): { width: number; height: number } | undefined {
    switch (aspectRatio) {
      case '1:1':
        return { width: 1328, height: 1328 };
      case '4:3':
        return { width: 1472, height: 1104 };
      case '3:4':
        return { width: 1104, height: 1472 };
      case '3:2':
        return { width: 1584, height: 1056 };
      case '2:3':
        return { width: 1056, height: 1584 };
      case '16:9':
        return { width: 1664, height: 936 };
      case '9:16':
        return { width: 936, height: 1664 };
      case '21:9':
        return { width: 2016, height: 864 };
      default:
        return undefined;
    }
  }
}
