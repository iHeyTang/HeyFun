import { BaseAigcModel, TextToImageParams } from '../core/base-model';
import { jimengT2iV31GetResultParamsSchema, jimengT2iV31SubmitParamsSchema, VolcengineJimengProvider } from '../providers/volcengine-jimeng';
import { GenerationTaskResult, GenerationType } from '../types';

/**
 * 即梦文生图3.1模型
 * https://www.volcengine.com/docs/85621/1756900
 */
export class JimengT2iV31 extends BaseAigcModel {
  name = 'jimeng-t2i-v31';
  displayName = '即梦 3.1(文生图)';
  description = '高质量文生图模型';
  parameterLimits = {
    aspectRatio: ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1', '21:9'],
    generationType: ['text-to-image'] as GenerationType[],
  };

  submitParamsSchema = jimengT2iV31SubmitParamsSchema;

  provider: VolcengineJimengProvider;
  constructor(provider: VolcengineJimengProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: TextToImageParams): Promise<string> {
    const size = this.convertAspectRatioToImageSize(params.aspectRatio);
    const parsed = this.submitParamsSchema.safeParse({
      req_key: 'jimeng_t2i_v31',
      prompt: params.prompt,
      seed: -1, // 使用默认种子
      width: size?.width,
      height: size?.height,
      use_pre_llm: true, // 使用预训练LLM
    });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.t2iV31Submit(parsed.data);
    console.log('result', result);
    return result.data.task_id;
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const parsed = jimengT2iV31GetResultParamsSchema.safeParse({
      task_id: params.taskId,
      req_key: 'jimeng_t2i_v31',
      req_json: { return_url: true },
    });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.t2iV31GetResult(parsed.data);
    return {
      status: this.getStatus(result.data.status),
      data: result.data.image_urls?.map((url: string) => ({ url, type: 'image' })) || [],
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
   * @see https://www.volcengine.com/docs/85621/1756900
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
