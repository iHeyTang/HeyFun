import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { VolcengineJimengProvider } from '../providers/volcengine-jimeng';
import { GenerationTaskResult, GenerationType } from '../types';

/**
 * 即梦视频 3.0 Pro模型
 * https://www.volcengine.com/docs/85621/1777001
 */
export class Jimeng30ProVideo extends BaseAigcModel {
  name = 'jimeng-3-0-pro-video';
  displayName = '即梦视频生成 3.0 Pro';
  description = '专业图生视频模型';
  costDescription = '1.10 Credits / second';
  generationTypes = ['image-to-video'] as GenerationType[];

  paramsSchema = z.object({
    prompt: z.string().describe('[title:提示词][renderType:textarea]'),
    firstFrame: z.string().describe('[title:首帧图片][renderType:image]'),
    aspectRatio: z.enum(['16:9', '9:16', '4:3', '3:4', '21:9']).describe('[title:画面比例]'),
    duration: z.enum(['5', '10']).describe('[title:视频时长(秒)][unit:s]'),
  });

  provider: VolcengineJimengProvider;
  constructor(provider: VolcengineJimengProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const host = 'https://visual.volcengineapi.com';
    const action = 'CVSync2AsyncSubmitTask';
    const version = '2022-08-31';
    const response = await this.provider.doRequest({
      host: host,
      method: 'POST',
      query: { Action: action, Version: version },
      body: JSON.stringify({
        req_key: 'jimeng_ti2v_v30_pro',
        prompt: params.prompt,
        image_urls: params.firstFrame ? [params.firstFrame] : [],
        seed: -1,
        frames: 24 * parseInt(params.duration) + 1,
        aspect_ratio: params.aspectRatio as '16:9' | '9:16' | '4:3' | '3:4' | '21:9',
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

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
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
      data: { status: 'in_queue' | 'generating' | 'done' | 'not_found' | 'expired'; video_url: string };
    };
    if (data.code !== 10000) {
      throw new Error(data.message);
    }
    return {
      status: this.getStatus(data.data.status),
      data: [{ data: data.data.video_url, sourceType: 'url', type: 'video' }],
      usage: {
        video_count: 1,
      },
    };
  }

  calculateCost(params: z.infer<typeof this.paramsSchema>): number {
    // 即梦AI-视频生成3.0 Pro: 1.1元/秒
    const pricePerSecond = 1100;
    const duration = parseInt(params.duration);
    return pricePerSecond * duration;
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
