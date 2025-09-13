import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { seedanceSubmitParamsSchema, VolcengineArkProvider } from '../providers/volcengine-ark';
import { GenerationTaskResult, GenerationType } from '../types';

/**
 * https://www.volcengine.com/docs/82379/1520757
 */
export class DoubaoSeedance10Pro250528 extends BaseAigcModel {
  name = 'doubao-seedance-1-0-pro-250528';
  displayName = '豆包视频生成 1.0 Pro';
  description = '全面强大，独具多镜头叙事能力';
  costDescription = '16.50 Credits / million tokens';
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
    const images: z.infer<typeof seedanceSubmitParamsSchema>['content'] = [];

    if (params.firstFrame) {
      images.push({ type: 'image_url', image_url: { url: params.firstFrame }, role: 'first_frame' });
    }

    const promptParameter = `--rs ${params.resolution} --rt ${params.aspectRatio} --dur ${params.duration} --fps 24 --wm false --seed -1 --cf ${params.camerafixed}`;
    const task = await this.provider.seedanceSubmit({
      model: 'doubao-seedance-1-0-pro-250528',
      content: [{ type: 'text', text: `${params.prompt}\n${promptParameter}` }, ...images],
    });
    if ('error' in task) {
      throw new Error(task.error.message);
    }
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

  calculateCost(params: z.infer<typeof this.paramsSchema>): number {
    // 根据表格数据创建分辨率映射
    const resolutionMap: Record<string, Record<string, { width: number; height: number }>> = {
      '480p': {
        '16:9': { width: 864, height: 480 },
        '4:3': { width: 736, height: 544 },
        '1:1': { width: 640, height: 640 },
        '21:9': { width: 960, height: 416 },
        '9:16': { width: 480, height: 864 },
        '3:4': { width: 544, height: 736 },
        '3:2': { width: 720, height: 480 },
        '2:3': { width: 480, height: 720 },
      },
      '720p': {
        '16:9': { width: 1248, height: 704 },
        '4:3': { width: 1120, height: 832 },
        '1:1': { width: 960, height: 960 },
        '21:9': { width: 1504, height: 640 },
        '9:16': { width: 704, height: 1248 },
        '3:4': { width: 832, height: 1120 },
        '3:2': { width: 1080, height: 720 },
        '2:3': { width: 720, height: 1080 },
      },
      '1080p': {
        '16:9': { width: 1920, height: 1088 },
        '4:3': { width: 1664, height: 1248 },
        '1:1': { width: 1440, height: 1440 },
        '21:9': { width: 2176, height: 928 },
        '9:16': { width: 1088, height: 1920 },
        '3:4': { width: 1248, height: 1664 },
        '3:2': { width: 1620, height: 1080 },
        '2:3': { width: 1080, height: 1620 },
      },
    };

    const resolution = params.resolution;
    const aspectRatio = params.aspectRatio;
    const duration = params.duration;
    const fps = 24; // 固定帧率24fps
    const pricePerMillionTokens = 16500; // 16.50元/百万token

    const dimensions = resolutionMap[resolution]?.[aspectRatio];

    if (!dimensions) {
      console.warn(`Can not get dimensions for ${resolution} ${aspectRatio}, use default value`);
      // 使用720p 16:9作为默认值
      const defaultDimensions = resolutionMap['720p']?.['16:9'];
      if (!defaultDimensions) {
        throw new Error('Can not get default dimensions');
      }
      const tokens = (defaultDimensions.width * defaultDimensions.height * fps * duration) / 1024;
      return (tokens / 1000000) * pricePerMillionTokens;
    }

    // 计算token数：(宽 × 高 × 帧率 × 时长) / 1024
    const tokens = (dimensions.width * dimensions.height * fps * duration) / 1024;

    // 计算价格：token数 / 1000000 * 16.50元
    const cost = (tokens / 1000000) * pricePerMillionTokens;

    return cost;
  }
}
