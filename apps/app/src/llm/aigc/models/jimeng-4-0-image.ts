import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { VolcengineJimengProvider } from '../providers/volcengine-jimeng';
import { GenerationTaskResult, GenerationType } from '../types';

/**
 * 即梦4.0模型（统一文生图和图生图）
 * https://www.volcengine.com/docs/85621/1616429
 */
export class Jimeng40 extends BaseAigcModel {
  name = 'jimeng-4-0-image';
  displayName = '即梦图片生成 4.0';
  description = '高质量文生图和图生图模型';
  costDescription = '0.3 Credits / image';
  generationTypes = ['text-to-image', 'image-to-image'] as GenerationType[];

  tags = ['recommended'];

  paramsSchema = z.object({
    prompt: z.string(),
    referenceImage: z.array(z.string()).min(0).max(10).optional(),
    aspectRatio: z.enum(['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1', '21:9']),
    advanced: z.object({
      guidance_scale: z.number().min(0).max(1).step(0.1).default(0.5).optional().describe('[title:Guidance Scale]'),
      force_single: z.boolean().default(false).optional().describe('[title:Force Single]'),
    }),
  });

  providerName = 'volcengine-jimeng';
  provider: VolcengineJimengProvider;
  constructor(provider: VolcengineJimengProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const size = this.convertAspectRatioToImageSize(params.aspectRatio);
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVSync2AsyncSubmitTask';
    const version = '2022-08-31';
    const response = await this.provider.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify({
        req_key: 'jimeng_t2i_v40',
        prompt: params.prompt,
        guidance_scale: params.advanced?.guidance_scale || 0.5,
        force_single: params.advanced?.force_single || false,
        seed: -1,
        width: size?.width || 1024,
        height: size?.height || 1024,
        scale: params.advanced?.guidance_scale || 0.5,
        image_urls: params.referenceImage || [],
      }),
      serviceName: 'cv',
      region: 'cn-north-1',
    });
    const data = (await response.json()) as { code: number; message: string; data: { task_id: string } };
    if (data.code !== 10000) {
      throw new Error(data.message);
    }
    return data.data.task_id;
  }

  async getTaskResult(params: { model: string; taskId: string }): Promise<GenerationTaskResult> {
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVSync2AsyncGetResult';
    const version = '2022-08-31';
    const response = await this.provider.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify(params),
      serviceName: 'cv',
      region: 'cn-north-1',
    });
    const data = (await response.json()) as {
      code: number;
      message: string;
      data: { status: 'in_queue' | 'generating' | 'done' | 'not_found' | 'expired'; image_urls: string[] };
    };
    if (data.code !== 10000) {
      throw new Error(data.message);
    }
    return {
      status: this.getStatus(data.data.status),
      data: data.data.image_urls?.map(url => ({ data: url, sourceType: 'url', type: 'image' })) || [],
      usage: {
        image_count: data.data.image_urls?.length || 0,
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

  calculateCost(params: z.infer<typeof this.paramsSchema>): number {
    return 300;
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
