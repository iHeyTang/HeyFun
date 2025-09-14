import crypto from 'crypto';
import qs from 'querystring';
import z from 'zod';

export interface SignParams {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  region?: string;
  serviceName?: string;
  method?: string;
  pathName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  needSignHeaderKeys?: string[];
  bodySha?: string;
}

export interface RequestParams {
  host: string;
  method: 'GET' | 'POST';
  query: { Version: string; Action: string };
  headers?: Record<string, string>;
  body: string;
  serviceName: string;
  region: string;
}

export const t2aSubmitParamsSchema = z.object({
  model: z.enum(['speech-2.5-hd-preview', 'speech-2.5-turbo-preview', 'speech-02-hd', 'speech-02-turbo', 'speech-01-hd', 'speech-01-turbo']),
  text: z.string().max(50000),
  voice_setting: z.object({
    voice_id: z.string(),
    speed: z.number().min(0.5).max(2).default(1).optional(),
    vol: z.number().min(0).max(10).default(1.0).optional(),
    pitch: z.number().int().min(-12).max(12).default(0).optional(),
    emotion: z.enum(['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm']).optional(),
  }),
  pronunciation_dict: z.object({ tone: z.array(z.string()) }).optional(),
  audio_setting: z
    .object({
      sample_rate: z.enum(['8000', '16000', '22050', '24000', '32000', '44100']).default('32000').optional(),
      bitrate: z.enum(['32000', '64000', '128000', '256000']).default('128000').optional(),
      format: z.enum(['mp3', 'pcm', 'flac']).default('mp3').optional(),
      channel: z.enum(['1', '2']).default('2').optional(),
      language_boost: z
        .enum([
          'Chinese',
          'Chinese,Yue',
          'English',
          'Arabic',
          'Russian',
          'Spanish',
          'French',
          'Portuguese',
          'German',
          'Turkish',
          'Dutch',
          'Ukrainian',
          'Vietnamese',
          'Indonesian',
          'Japanese',
          'Italian',
          'Korean',
          'Thai',
          'Polish',
          'Romanian',
          'Greek',
          'Czech',
          'Finnish',
          'Hindi',
          'Bulgarian',
          'Danish',
          'Hebrew',
          'Malay',
          'Persian',
          'Slovak',
          'Swedish',
          'Croatian',
          'Filipino',
          'Hungarian',
          'Norwegian',
          'Slovenian',
          'Catalan',
          'Nynorsk',
          'Tamil',
          'Afrikaans',
          'auto',
        ])
        .default('auto')
        .optional(),
      voice_modify: z
        .object({
          pitch: z.number().int().min(-100).max(100).default(0).optional().describe('音高调整 (低沉/明亮)'),
          intensity: z.number().int().min(-100).max(100).default(0).optional().describe('强度调整 (力量感/柔和)'),
          timbre: z.number().int().min(-100).max(100).default(0).optional().describe('音色调整 (磁性/清脆)'),
          sound_effects: z.enum(['spacious_echo', 'auditorium_echo', 'lofi_telephone', 'robotic']).optional().describe('音效设置, 单次仅能选择一种'),
        })
        .optional(),
      aigc_watermark: z.boolean().default(false).optional().describe('是否添加aigc水印'),
    })
    .optional(),
});

export const minimaxServiceConfigSchema = z.object({
  apiKey: z.string(),
});

export class MinimaxProvider {
  private apiKey: string;

  constructor(config: z.infer<typeof minimaxServiceConfigSchema>) {
    this.apiKey = config.apiKey;
  }

  async t2a(params: z.infer<typeof t2aSubmitParamsSchema>) {
    const res = await fetch('https://api.minimaxi.com/v1/t2a_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(params),
    });
    const resBody = (await res.json()) as {
      data: { audio: string; subtitle_file?: string; status: number };
      extra_info: {
        audio_length: number;
        audio_sample_rate: number;
        audio_size: number;
        bitrate: number;
        word_count: number;
        invisible_character_ratio: number;
        usage_characters: number;
        audio_format: string;
        audio_channel: number;
      };
      trace_id: string;
      base_resp: { status_code: number; status_msg: string };
    };
    return resBody;
  }

  /**
   * 文本转语音提交任务
   * https://platform.minimaxi.com/document/t2a_async_create?key=68adac886602726333001546
   */
  async t2aSubmit(params: z.infer<typeof t2aSubmitParamsSchema>) {
    const res = await fetch('https://api.minimaxi.com/v1/t2a_async_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(params),
    });
    const resBody = (await res.json()) as { task_id: bigint };
    return { task_id: resBody.task_id.toString() };
  }

  /**
   * 文本转语音查询任务
   * https://platform.minimaxi.com/document/t2a_async_query?key=68adad0f6fe587e3fbfe9810
   */
  async t2aQuery(taskId: string) {
    const res = await fetch(`http://api.minimaxi.com/v1/query/t2a_async_query_v2?task_id=${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    const resBody = (await res.json()) as {
      task_id: string;
      status: 'Processing' | 'Success' | 'Failed' | 'Expired';
      file_id: bigint;
      status_message: string;
    };

    if (resBody.status === 'Failed') {
      throw new Error(resBody.status_message);
    }
    return resBody;
  }

  /**
   * 获取声音列表
   * https://platform.minimaxi.com/document/get_voice?key=68b51016d2f0aaaf3484a8de
   * @returns
   */
  async getVoice() {
    const res = await fetch('https://api.minimaxi.com/v1/get_voice', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voice_type: 'all',
      }),
    });
    const resBody = (await res.json()) as {
      system_voice: {
        voice_id: string;
        voice_name: string;
        description: string[];
      }[];
      voice_cloning: {
        voice_id: string;
        description: string[];
        created_time: string;
      }[];
      voice_generation: {
        voice_id: string;
        description: string[];
        created_time: string;
      }[];
    };
    return resBody;
  }

  /**
   * 根据文件ID获取文件信息
   * https://platform.minimaxi.com/document/files_retrieve?key=68b56abca96516e26019203a
   * @param file_id
   * @returns
   */
  async retrieveFileById(file_id: string) {
    const res = await fetch(`https://api.minimaxi.com/v1/files/retrieve?file_id=${file_id}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    const resBody = (await res.json()) as {
      file: {
        file_id: bigint;
        bytes: bigint;
        filename: string;
        download_url: string;
      };
      base_resp: { status_code: number; status_msg: string };
    };
    if (resBody.base_resp.status_code !== 0) {
      throw new Error(resBody.base_resp.status_msg);
    }
    return { file_id: resBody.file.file_id, file_name: resBody.file.filename, file_size: resBody.file.bytes, file_url: resBody.file.download_url };
  }

  /**
   * 根据文件URL下载文件
   * https://platform.minimaxi.com/document/files_retrieve_content?key=68b56ae2a96516e2601920d2
   * @param file_url
   * @returns
   */
  async downloadFileByUrl(file_url: string): Promise<Buffer> {
    const res = await fetch(`https://api.minimaxi.com/v1/files/retrieve_content?url=${file_url}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    const resBody = await res.arrayBuffer();
    return Buffer.from(resBody);
  }

  async downloadFileById(file_id: string): Promise<Buffer> {
    const file = await this.retrieveFileById(file_id);
    return this.downloadFileByUrl(file.file_url);
  }
}
