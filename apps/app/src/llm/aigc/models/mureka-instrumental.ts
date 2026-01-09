import z from 'zod';
import { BaseAigcModel } from '../core/base-model';
import { MurekaProvider } from '../providers/mureka';
import { GenerationTaskResult, GenerationType } from '../types';

const paramsSchema = z.object({
  lyrics: z.undefined().optional(),
  prompt: z.string().optional(),
  advanced: z
    .object({
      // referenceId: z.string().optional(),
      // vocal_id: z.string().optional(),
      // melody_id: z.string().optional(),
      model: z.enum(['auto', 'mureka-6', 'mureka-7.5', 'mureka-o1']).optional().describe('[title:Model]'),
    })
    .optional(),
});

type InstrumentalTaskStatus = 'preparing' | 'queued' | 'running' | 'streaming' | 'succeeded' | 'failed' | 'timeouted' | 'cancelled';

type InstrumentalTaskResult = {
  id: string;
  created_at: number;
  finished_at?: number;
  model: string;
  status: InstrumentalTaskStatus;
  failed_reason?: string;
  choices?: {
    index: number;
    id: string;
    url: string;
    flac_url: string;
    stream_url: string;
    duration: number;
  }[];
};

/**
 * Mureka Instrumental
 * https://platform.mureka.ai/docs/api/operations/post-v1-instrumental-generate.html
 */
export class MurekaInstrumental extends BaseAigcModel {
  name = 'mureka-instrumental';
  displayName = 'Mureka Instrumental';
  description = 'Mureka Instrumental';
  costDescription = '0.5 Credits / song';
  generationTypes = ['music'] as GenerationType[];

  paramsSchema = paramsSchema;

  providerName = 'mureka';
  provider: MurekaProvider;
  constructor(provider: MurekaProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const data = await this.provider.request<InstrumentalTaskResult>({
      path: '/v1/instrumental/generate',
      method: 'POST',
      body: {
        model: params.advanced?.model || 'auto',
        n: 1,
        prompt: params.prompt,
        // reference_id: params.advanced?.referenceId,
        // vocal_id: params.advanced?.vocal_id,
        // melody_id: params.advanced?.melody_id,
      },
    });
    if (!data.id) {
      throw new Error(data.failed_reason || 'Unknown error');
    }
    return data.id;
  }

  async getTaskResult(params: { model: string; taskId: string; params: z.infer<typeof paramsSchema> }): Promise<GenerationTaskResult> {
    const path = `/v1/instrumental/query/${params.taskId}`;
    const data = await this.provider.request<InstrumentalTaskResult>({ path, method: 'GET' });
    if (!data.id) {
      throw new Error(data.failed_reason || 'Unknown error');
    }
    const status = this.getStatus(data.status || '');

    if (status !== 'completed') {
      return {
        status,
      };
    }

    return {
      status,
      data:
        data.choices?.map(choice => ({
          data: { url: choice.url, flac_url: choice.flac_url },
          sourceType: 'music',
        })) || [],
    };
  }

  private getStatus(status: InstrumentalTaskStatus): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (status) {
      case 'succeeded':
        return 'completed';
      case 'running':
        return 'processing';
      case 'preparing':
        return 'pending';
      case 'queued':
        return 'pending';
      case 'timeouted':
        return 'failed';
      case 'cancelled':
        return 'failed';
      case 'failed':
        return 'failed';
      default:
        return 'failed';
    }
  }

  calculateCost(params: z.infer<typeof this.paramsSchema>): number {
    return 500;
  }
}
