import z from 'zod';
import { BaseAigcModel, Voice, VoiceCloneParams, VoiceCloneResult } from '../core/base-model';
import { GenerationTaskResult, GenerationType } from '../types';
import { MinimaxProvider } from '../providers/minimax';
import { ToAsyncTaskManager } from '../../utils/to-async-task';

const toAsync = new ToAsyncTaskManager<Awaited<ReturnType<MinimaxProvider['t2a']>>>();

const toAsyncCloneVoice = new ToAsyncTaskManager<Awaited<ReturnType<MinimaxProvider['cloneVoice']>> & { voice_id: string }>();

const minimax25SpeechParamsSchema = z.object({
  text: z.string(),
  voice_id: z.string(),
  advanced: z
    .object({
      mode: z.enum(['hd', 'turbo']),
      speed: z.number().min(0.5).max(2).step(0.1).default(1).optional(),
      vol: z.number().min(0).max(10).step(0.1).default(1.0).optional(),
      pitch: z.number().int().min(-12).max(12).default(0).optional(),
      emotion: z.enum(['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm']).optional(),
    })
    .optional(),
});

/**
 * https://platform.minimaxi.com/document/t2a_async_api_intro?key=68adac446fe587e3fbfe965b
 */
export class Minimax25Speech extends BaseAigcModel {
  name = 'minimax-2-5-speech';
  displayName = 'Minimax 2.5 语音合成';
  description = '高质量语音合成模型';
  costDescription = '3.85(HD)/2.2(Turbo) Credits /M Characters';
  generationTypes = ['text-to-speech'] as GenerationType[];

  paramsSchema = minimax25SpeechParamsSchema;

  provider: MinimaxProvider;
  constructor(provider: MinimaxProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    const modelName = this.detectModelName(params);

    // 同步语音合成可以处理10万字符以内，9万字默认使用同步，超过9万字使用异步
    if (params.text.length < 90000) {
      const task = toAsync.addTask(
        this.provider.t2a({
          model: modelName,
          text: params.text,
          voice_setting: {
            voice_id: params.voice_id,
            speed: params.advanced?.speed,
            vol: params.advanced?.vol,
            pitch: params.advanced?.pitch,
            emotion: params.advanced?.emotion,
          },
        }),
      );
      return task.id;
    }

    const task = await this.provider.t2aSubmit({
      model: modelName,
      text: params.text,
      voice_setting: {
        voice_id: params.voice_id,
        speed: params.advanced?.speed,
        vol: params.advanced?.vol,
        pitch: params.advanced?.pitch,
        emotion: params.advanced?.emotion,
      },
    });
    return task.task_id;
  }

  async getTaskResult(params: { model: string; taskId: string; params: z.infer<typeof minimax25SpeechParamsSchema> }): Promise<GenerationTaskResult> {
    if (params.params.text.length < 90000) {
      const task = toAsync.getTask(params.taskId);
      if (task) {
        return {
          status: task.status === 'succeeded' ? 'completed' : task.status === 'failed' ? 'failed' : 'pending',
          data: task.result?.data ? [{ data: task.result.data.audio, sourceType: 'hex', type: 'audio', fileExtension: '.mp3' }] : [],
          error: task.error || undefined,
        };
      }
    }

    const result = await this.provider.t2aQuery(params.taskId);
    if (result.status !== 'Success') {
      return {
        status: result.status === 'Failed' ? 'failed' : 'pending',
        data: [],
        usage: {},
      };
    }
    const url = await this.provider.retrieveFileById(result.file_id.toString());
    if (!result) {
      throw new Error('Task not found');
    }
    return {
      status: result.status === 'Success' ? 'completed' : result.status === 'Failed' ? 'failed' : 'pending',
      data: result.file_id ? [{ data: url.file_url, sourceType: 'url', type: 'audio', fileExtension: '.mp3' }] : [],
      usage: {},
    };
  }

  private detectModelName(params: z.infer<typeof this.paramsSchema>) {
    if (params.advanced?.mode === 'hd') {
      return 'speech-2.5-hd-preview';
    }
    return 'speech-2.5-turbo-preview';
  }

  calculateCost(params: z.infer<typeof this.paramsSchema>): number {
    const pricePerMillionChars = params.advanced?.mode === 'hd' ? 3850 : 2200;
    const charCount = params.text.length;
    return Number(Math.max(1, (pricePerMillionChars * charCount) / 1000000));
  }

  /**
   * Override the base class method
   * @returns
   */
  async getVoiceList(): Promise<Voice[]> {
    const voices = await this.provider.getVoice();
    return [...(voices.system_voice || []), ...(voices.voice_cloning || []), ...(voices.voice_generation || [])].map(v => ({
      id: v.voice_id,
      name: 'voice_name' in v && typeof v.voice_name === 'string' ? v.voice_name : v.description?.[0] || v.voice_id,
      description: v.description?.join('\n'),
    }));
  }

  async cloneVoice(params: VoiceCloneParams): Promise<string> {
    const fileId = await this.provider.uploadFile({ purpose: 'prompt_audio', file: params.audio });
    // 生成256长度的随机id
    const timestamp = Date.now().toString();
    const randomPart = Array.from({ length: 256 - timestamp.length - 22 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const voiceId = `heyfun-voice_cloning-${timestamp}-${randomPart}`;
    const result = toAsyncCloneVoice.addTask(async () => {
      const res = await this.provider.cloneVoice({ voice_id: voiceId, file_id: fileId, text: params.text, model: 'speech-2.5-hd-preview' });
      return { ...res, voice_id: voiceId };
    });
    return result.id;
  }

  async getCloneVoiceResult(task_id: string): Promise<VoiceCloneResult> {
    const result = toAsyncCloneVoice.getTask(task_id);
    if (!result) {
      throw new Error('Task not found');
    }
    return {
      success: result.result?.base_resp.status_code === 0,
      voiceId: result.result?.voice_id,
      error: result.result?.base_resp.status_code !== 0 ? result.result?.base_resp.status_msg : undefined,
      demo_audio: { type: 'url', data: result.result?.demo_audio || '' },
    };
  }

  async deleteVoice(voice_id: string) {
    const voiceType = voice_id.startsWith('heyfun-voice_cloning-') ? 'voice_cloning' : 'voice_generation';
    const result = await this.provider.deleteVoice(voiceType, voice_id);
    return {
      success: result.base_resp.status_code === 0,
      error: result.base_resp.status_code !== 0 ? result.base_resp.status_msg : undefined,
    };
  }
}
