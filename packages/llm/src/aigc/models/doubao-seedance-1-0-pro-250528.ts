import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { seedance10ProSubmitParamsSchema, VolcengineArkProvider } from '../providers/volcengine-ark';
import { GenerationTaskResult, GenerationType } from '../types';

/**
 * https://www.volcengine.com/docs/82379/1520757
 */
export class DoubaoSeedance10Pro250528 extends BaseAigcModel {
  name = 'doubao-seedance-1-0-pro-250528';
  displayName = '豆包视频生成 1.0 Pro';
  description = '全面强大，独具多镜头叙事能力';
  generationTypes = ['image-to-video', 'text-to-video'] as GenerationType[];

  paramsSchema = z.object({
    prompt: z.string().describe('[title:提示词][renderType:textarea]'),
    firstFrame: z.string().describe('[title:首帧图片][renderType:image]'),
    resolution: z.enum(['480p', '720p', '1080p']).default('720p').describe('[title:分辨率]'),
    aspectRatio: z.enum(['16:9', '4:3', '9:16', '3:4', '3:2', '2:3', '1:1', '21:9']).describe('[title:画面比例][renderType:ratio]'),
    duration: z.number().min(3).max(12).default(5).describe('[title:视频时长(秒)][unit:s]'),
    camerafixed: z.boolean().default(false).describe('[title:固定镜头]'),
  });

  provider: VolcengineArkProvider;
  constructor(provider: VolcengineArkProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const images: z.infer<typeof seedance10ProSubmitParamsSchema>['content'] = [];

    if (params.firstFrame) {
      images.push({ type: 'image', image_url: { url: params.firstFrame }, role: 'first_frame' });
    }

    const task = await this.provider.seedanceSubmit({
      model: 'doubao-seedance-1-0-pro-250528',
      content: [
        { type: 'text', text: params.prompt },
        {
          type: 'text',
          text: `--rs ${params.resolution} --rt ${params.aspectRatio} --dur ${params.duration} --fps 24 --wm false --seed -1 --cf ${params.camerafixed}`,
        },
        ...images,
      ],
    });
    return task.id;
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const result = await this.provider.seedanceGetResult({ id: params.taskId });
    if (!result) {
      throw new Error('Task not found');
    }
    return {
      status: result.status === 'succeeded' ? 'completed' : result.status === 'failed' ? 'failed' : 'pending',
      data: result.content?.video_url ? [{ url: result.content.video_url, type: 'video' }] : [],
      usage: { video_count: result.content?.video_url ? 1 : 0 },
    };
  }
}
