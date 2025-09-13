import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { seedanceSubmitParamsSchema, VolcengineArkProvider } from '../providers/volcengine-ark';
import { GenerationTaskResult, GenerationType } from '../types';

/**
 * https://www.volcengine.com/docs/82379/1520757
 */
export class DoubaoSeedance10LiteVideo extends BaseAigcModel {
  name = 'doubao-seedance-1-0-lite-video';
  displayName = '豆包视频生成 1.0 Lite';
  description = '精准响应，性价比高';
  generationTypes = ['text-to-video', 'image-to-video'] as GenerationType[];

  models = {
    'doubao-seedance-1-0-lite-i2v-250428': {
      cost: {},
    },
    'doubao-seedance-1-0-lite-t2v-250428': {},
  };

  paramsSchema = z.object({
    prompt: z.string().describe('[title:提示词][renderType:textarea]'),
    firstFrame: z.string().describe('[title:首帧图片][renderType:image]').optional(),
    lastFrame: z.string().describe('[title:尾帧图片][renderType:image]').optional(),
    referenceImage: z.array(z.string()).describe('[title:参考图片][renderType:imageArray]').min(1).max(4).optional(),
    resolution: z.enum(['480p', '720p']).default('720p').describe('[title:分辨率]'),
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
    const modelName = this.detectModelName(params);

    const images: z.infer<typeof seedanceSubmitParamsSchema>['content'] = [];

    if (modelName === 'doubao-seedance-1-0-lite-i2v-250428') {
      if (params.firstFrame) {
        images.push({ type: 'image_url', image_url: { url: params.firstFrame }, role: 'first_frame' });
      }
      if (params.lastFrame) {
        images.push({ type: 'image_url', image_url: { url: params.lastFrame }, role: 'last_frame' });
      }
      if (params.referenceImage?.length) {
        images.push(
          ...params.referenceImage.map(image => ({
            type: 'image_url' as const,
            image_url: { url: image },
            role: 'reference_image' as const,
          })),
        );
      }
    }

    const promptParameter = `--rs ${params.resolution} --rt ${params.aspectRatio} --dur ${params.duration} --fps 24 --wm false --seed -1 --cf ${params.camerafixed}`;
    const task = await this.provider.seedanceSubmit({
      model: modelName as 'doubao-seedance-1-0-lite-i2v-250428' | 'doubao-seedance-1-0-lite-t2v-250428',
      content: [{ type: 'text', text: `${params.prompt}\n${promptParameter}` }, ...images],
    });
    if ('error' in task) {
      throw new Error(task.error.message);
    }
    return task.id;
  }

  async getTaskResult(params: { model: string; taskId: string }): Promise<GenerationTaskResult> {
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

  private detectModelName(params: z.infer<typeof this.paramsSchema>): string {
    if (params.firstFrame || params.lastFrame || params.referenceImage?.length) {
      return 'doubao-seedance-1-0-lite-i2v-250428';
    }
    return 'doubao-seedance-1-0-lite-t2v-250428';
  }
}
