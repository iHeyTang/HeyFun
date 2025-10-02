import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { A302aiProvider } from '../providers/a302ai';
import { GenerationTaskResult, GenerationType } from '../types';
import { getMediaDuration } from '../utils/downloader';

const paramsSchema = z.object({
  video: z.string(),
  audio: z.string(),
  advanced: z
    .object({
      sync_mode: z.enum(['loop', 'bounce', 'cut_off', 'silence', 'remap']),
      model: z.enum(['lipsync-2', 'lipsync-2-pro']).default('lipsync-2'),
    })
    .optional(),
});

/**
 * Sync So V2
 * https://doc.302.ai/api-322183267
 */
export class SyncSoV2 extends BaseAigcModel {
  name = 'sync-so-v2';
  displayName = 'Sync So V2';
  description = 'Sync So V2';
  costDescription = 'Normal: 0.96 Credits/s; Pro: 1.44 Credits/s';
  generationTypes = ['lip-sync'] as GenerationType[];

  paramsSchema = paramsSchema;

  provider: A302aiProvider;
  constructor(provider: A302aiProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const model = this.detectModel(params);

    const data = await this.provider.request<{ id: string; status: string; error?: string }>({
      path: '/sync-so/v2/generate',
      method: 'POST',
      body: {
        model,
        input: [
          { type: 'video', url: params.video },
          { type: 'audio', url: params.audio },
        ],
        options: {
          sync_mode: params.advanced?.sync_mode || 'silence',
        },
      },
    });
    if (!data.id) {
      throw new Error(data.error || 'Unknown error');
    }
    return data.id;
  }

  async getTaskResult(params: { model: string; taskId: string; params: z.infer<typeof paramsSchema> }): Promise<GenerationTaskResult> {
    const path = `/sync-so/v2/generate/${params.taskId}`;
    const data = await this.provider.request<{ id: string; status: 'PROCESSING' | 'COMPLETED'; outputUrl: string }>({ path, method: 'GET' });

    const status = this.getStatus(data.status || 'PROCESSING');

    if (status !== 'completed') {
      return {
        status,
      };
    }

    return {
      status,
      data: [{ data: data.outputUrl, sourceType: 'url', type: 'video' }],
      usage: { video_count: 1 },
    };
  }

  private detectModel(params: z.infer<typeof this.paramsSchema>): string {
    return params.advanced?.model || 'lipsync-2';
  }

  private getStatus(status: 'PROCESSING' | 'COMPLETED'): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (status) {
      case 'PROCESSING':
        return 'processing';
      case 'COMPLETED':
        return 'completed';
      default:
        return 'failed';
    }
  }

  /**
   * 精确计算成本（推荐使用此方法获得最准确的价格）
   * 使用真实的媒体文件元数据获取精确时长
   */
  async calculateCost(params: z.infer<typeof this.paramsSchema>, outputs: GenerationTaskResult): Promise<number> {
    const model = params.advanced?.model || 'lipsync-2';

    // 价格定义 (厘/帧)
    const pricePerFrame = model === 'lipsync-2-pro' ? 60 : 40;

    // 获取视频时长信息
    const videoDuration = await getMediaDuration(outputs.data?.[0]?.data || '');

    // 假设帧率为24fps（常见的视频帧率）使用常见的视频帧率24fps
    const fps = 24;
    const totalFrames = videoDuration * fps;

    const cost = pricePerFrame * totalFrames;

    // 返回成本（以厘为单位）
    return cost;
  }
}
