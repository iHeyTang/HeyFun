import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { DashscopeWanProvider, i2vGetResultParamsSchema, i2vSubmitParamsSchema } from '../providers/aliyun-dashscope';
import { GenerationTaskResult, GenerationType } from '../types';

/**
 * 万相I2V Plus模型
 * https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2867393
 */
export class Wan22I2vPlus extends BaseAigcModel {
  name = 'wan2.2-i2v-plus';
  displayName = '万相 2.2 Plus(图生视频)';
  description = '高质量图生视频模型';
  parameterLimits = {
    aspectRatio: ['1:1', '16:9', '9:16'],
    duration: [5],
    generationType: ['image-to-video'] as GenerationType[],
  };

  paramsSchema = z.object({
    prompt: z.string().optional().describe('[title:提示词][renderType:textarea]'),
    referenceImage: z.string().describe('[title:参考图片][renderType:image]'),
    aspectRatio: z.enum(['1:1', '16:9', '9:16']).describe('[title:画面比例][renderType:ratio]'),
    duration: z.number().min(5).max(5).default(5).describe('[title:视频时长(秒)][unit:s]'),
  });

  provider: DashscopeWanProvider;
  constructor(provider: DashscopeWanProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const result = await this.provider.i2vSubmit({
      model: 'wan2.2-i2v-plus',
      input: {
        prompt: params.prompt || '',
        image_url: params.referenceImage,
      },
      parameters: {
        resolution: undefined,
        duration: params.duration,
        prompt_extend: true,
        seed: 0,
        watermark: false,
      },
    });
    return result.output.task_id;
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const parsed = i2vGetResultParamsSchema.safeParse({ task_id: params.taskId });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const result = await this.provider.i2vGetResult(parsed.data);
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
