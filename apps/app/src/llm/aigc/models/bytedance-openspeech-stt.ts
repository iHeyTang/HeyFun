import nodeCrypto from 'crypto';
import z from 'zod';
import { BaseAigcModel, speechToTextParamsSchema } from '../core/base-model';
import { BytedanceOpenspeechProvider } from '../providers/bytedance-openspeech';
import { GenerationTaskResult, GenerationType } from '../types';

// 兼容服务器端和客户端的 UUID 生成函数
function randomUUID(): string {
  // 在 Node.js 环境中使用 crypto 模块
  if (typeof window === 'undefined') {
    // 服务器端：使用 Node.js crypto 模块（动态导入避免 webpack 处理 node: 协议）
    return nodeCrypto.randomUUID();
  }
  // 客户端：使用 Web Crypto API
  return globalThis.crypto.randomUUID();
}

const bytedanceOpenspeechSttParamsSchema = speechToTextParamsSchema.extend({
  audio: z.string().describe('音频文件URL'),
  language: z.string().optional().describe('语言代码（可选），例如：zh、en等'),
});

/**
 * 提交任务的请求体类型
 */
interface SubmitTaskRequest {
  user?: {
    uid?: string;
  };
  audio: {
    url: string;
    language?: string;
    format: string;
    codec?: string;
    rate?: number;
    bits?: number;
    channel?: number;
  };
  request: {
    model_name: 'bigmodel';
    model_version?: '400' | '310';
    enable_itn?: boolean;
    enable_punc?: boolean;
    enable_ddc?: boolean;
    enable_speaker_info?: boolean;
    enable_channel_split?: boolean;
    show_utterances?: boolean;
    show_speech_rate?: boolean;
    show_volume?: boolean;
    enable_lid?: boolean;
    enable_emotion_detection?: boolean;
    enable_gender_detection?: boolean;
    vad_segment?: boolean;
    end_window_size?: number;
    sensitive_words_filter?: 'system_reserved_filter' | 'filter_with_empty' | 'filter_with_signed';
    enable_poi_fc?: boolean;
    enable_music_fc?: boolean;
    corpus?: string;
    boosting_table_name?: string;
    correct_table_name?: string;
    context?: string;
  };
  callback?: string;
  callback_data?: string;
}

/**
 * 查询任务的请求体类型
 */
interface QueryTaskRequest {
  id: string;
}

/**
 * 查询任务的响应类型
 */
interface QueryTaskResponse {
  audio_info?: {
    duration: number;
  };
  result?: {
    text: string;
    utterances?: Array<{
      definite: boolean;
      end_time: number;
      start_time: number;
      text: string;
      words?: Array<{
        blank_duration: number;
        end_time: number;
        start_time: number;
        text: string;
      }>;
    }>;
  };
}

/**
 * 从音频URL或参数中提取音频格式
 * @param audioUrl 音频文件URL
 * @param specifiedFormat 用户指定的格式（可选）
 * @param defaultFormat 默认格式，默认为 'mp3'
 * @returns 音频格式字符串
 */
function extractAudioFormat(audioUrl: string, specifiedFormat?: string, defaultFormat: string = 'mp3'): string {
  if (specifiedFormat) {
    return specifiedFormat;
  }

  if (audioUrl.includes('.')) {
    const extension = audioUrl.split('.').pop()?.toLowerCase();
    if (extension && ['wav', 'mp3', 'm4a', 'flac', 'aac'].includes(extension)) {
      return extension;
    }
  }

  return defaultFormat;
}

/**
 * 字节跳动 OpenSpeech 语音识别模型
 * https://openspeech.bytedance.com/
 */
export class BytedanceOpenspeechStt extends BaseAigcModel {
  name = 'bytedance-openspeech-stt';
  displayName = '字节跳动 OpenSpeech 语音识别';
  description = '高质量语音识别模型，支持多种音频格式和语言';
  costDescription = '按使用量计费';
  generationTypes = ['speech-to-text'] as GenerationType[];

  paramsSchema = bytedanceOpenspeechSttParamsSchema;

  providerName = 'bytedance-openspeech';
  provider: BytedanceOpenspeechProvider;
  resourceId = 'volc.seedasr.auc'; // 该模型固定的 resourceId

  constructor(provider: BytedanceOpenspeechProvider) {
    super();
    this.provider = provider;
  }

  async submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string> {
    console.log(`[${this.name}] submitTask called with params:`, {
      audio: params.audio,
      language: params.language,
    });

    const format = extractAudioFormat(params.audio, params.advanced?.format);
    console.log(`[${this.name}] Extracted audio format:`, format);

    const requestBody: SubmitTaskRequest = {
      audio: {
        url: params.audio,
        format,
      },
      request: {
        model_name: 'bigmodel',
      },
    };

    const requestId = randomUUID();
    console.log(`[${this.name}] Submitting task with requestId:`, requestId);
    console.log(`[${this.name}] Request body:`, JSON.stringify(requestBody, null, 2));

    try {
      const { data: result, headers } = await this.provider.request<{
        user: { uid: string };
        audio: { format: string; url: string };
        request: { model_name: 'bigmodel'; enable_itn: boolean };
      }>('POST', '/api/v3/auc/bigmodel/submit', requestBody, {
        'X-Api-Resource-Id': this.resourceId,
        'X-Api-Request-Id': requestId,
      });

      // 打印响应头中的关键信息
      const logId = headers['x-tt-logid'] || headers['X-Tt-Logid'];
      const statusCode = headers['x-api-status-code'] || headers['X-Api-Status-Code'];
      const message = headers['x-api-message'] || headers['X-Api-Message'];

      if (logId) {
        console.log(`[${this.name}] X-Tt-Logid:`, logId);
      }
      if (statusCode) {
        console.log(`[${this.name}] X-Api-Status-Code:`, statusCode);
      }
      if (message) {
        console.log(`[${this.name}] X-Api-Message:`, message);
      }
      console.log(`[${this.name}] Submit response:`, JSON.stringify(result, null, 2));
      console.log(`[${this.name}] Task submitted successfully, returning requestId:`, requestId);
      return requestId;
    } catch (error) {
      console.error(`[${this.name}] Submit task failed:`, error);
      throw error;
    }
  }

  async getTaskResult(params: {
    model: string;
    taskId: string;
    params: z.infer<typeof bytedanceOpenspeechSttParamsSchema>;
  }): Promise<GenerationTaskResult> {
    const { taskId } = params;
    console.log(`[${this.name}] getTaskResult called for taskId:`, taskId);

    const requestBody: QueryTaskRequest = {
      id: taskId,
    };

    try {
      const { data: result, headers } = await this.provider.request<QueryTaskResponse>('POST', '/api/v3/auc/bigmodel/query', requestBody, {
        'X-Api-Resource-Id': this.resourceId,
        'X-Api-Request-Id': taskId,
      });

      // 打印响应头中的关键信息
      const logId = headers['x-tt-logid'] || headers['X-Tt-Logid'];
      const statusCode = headers['x-api-status-code'] || headers['X-Api-Status-Code'];
      const message = headers['x-api-message'] || headers['X-Api-Message'];

      if (logId) {
        console.log(`[${this.name}] X-Tt-Logid:`, logId);
      }
      if (statusCode) {
        console.log(`[${this.name}] X-Api-Status-Code:`, statusCode);
      }
      if (message) {
        console.log(`[${this.name}] X-Api-Message:`, message);
      }
      console.log(`[${this.name}] Query response:`, JSON.stringify(result));
      console.log(`[${this.name}] Query response (full):`, JSON.stringify(result, null, 2));

      // 根据 X-Api-Status-Code 判断任务状态
      // 20000000: 成功
      // 20000001: 正在处理中
      // 20000002: 任务在队列中
      // 20000003: 静音音频（需要重新submit）
      // 45000001: 请求参数无效
      // 45000002: 空音频
      // 45000151: 音频格式不正确
      // 550xxxx: 服务内部处理错误
      // 55000031: 服务器繁忙

      const statusCodeNum = statusCode ? parseInt(statusCode, 10) : null;

      // 处理静音音频错误（需要重新submit）
      if (statusCodeNum === 20000003) {
        console.warn(`[${this.name}] Silent audio detected (status code: ${statusCodeNum}), need to resubmit`);
        return {
          status: 'failed',
          error: 'Silent audio detected, please resubmit the task',
        };
      }

      // 处理请求参数错误
      if (statusCodeNum === 45000001) {
        console.error(`[${this.name}] Invalid request parameters (status code: ${statusCodeNum})`);
        return {
          status: 'failed',
          error: message || 'Invalid request parameters',
        };
      }

      // 处理空音频错误
      if (statusCodeNum === 45000002) {
        console.error(`[${this.name}] Empty audio (status code: ${statusCodeNum})`);
        return {
          status: 'failed',
          error: message || 'Empty audio file',
        };
      }

      // 处理音频格式错误
      if (statusCodeNum === 45000151) {
        console.error(`[${this.name}] Invalid audio format (status code: ${statusCodeNum})`);
        return {
          status: 'failed',
          error: message || 'Invalid audio format',
        };
      }

      // 处理服务器错误
      if (statusCodeNum && statusCodeNum >= 55000000 && statusCodeNum < 56000000) {
        console.error(`[${this.name}] Server error (status code: ${statusCodeNum})`);
        if (statusCodeNum === 55000031) {
          return {
            status: 'failed',
            error: message || 'Server busy, please try again later',
          };
        }
        return {
          status: 'failed',
          error: message || `Server internal error (code: ${statusCodeNum})`,
        };
      }

      // 根据 statusCode 20000000 判断任务完成
      if (statusCodeNum === 20000000) {
        console.log(`[${this.name}] Task completed (status code: ${statusCodeNum})`);
        const taskResult = result.result;
        if (!taskResult) {
          console.error(`[${this.name}] Task completed but no result found`);
          return {
            status: 'failed',
            error: 'Task completed but no result found',
          };
        }

        // 获取音频时长（毫秒转秒）
        const duration = result.audio_info?.duration ? result.audio_info.duration / 1000 : undefined;
        console.log(`[${this.name}] Audio duration:`, duration, 'seconds');

        // 将 utterances 转换为 segments 格式（兼容之前的格式）
        const segments =
          taskResult.utterances?.map(utterance => ({
            start: utterance.start_time / 1000, // 毫秒转秒
            end: utterance.end_time / 1000,
            text: utterance.text,
          })) || [];

        console.log(`[${this.name}] Transcribed text:`, taskResult.text);
        console.log(`[${this.name}] Utterances count:`, taskResult.utterances?.length || 0);
        console.log(`[${this.name}] Segments count:`, segments.length);

        // 返回文本结果
        // 注意：语音识别返回的是文本，不是音频文件
        // 我们将文本内容和 segments 信息都编码到 JSON 中，通过 data URL 返回
        const resultData = {
          text: taskResult.text || '',
          segments,
          utterances: taskResult.utterances,
          duration,
        };
        const resultJson = JSON.stringify(resultData);
        const resultDataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(resultJson)}`;

        console.log(`[${this.name}] Task completed successfully, returning result`);
        return {
          status: 'completed',
          data: [
            {
              sourceType: 'url',
              type: 'audio', // 类型系统需要 audio 类型，但实际内容是 JSON（包含文本和 segments）
              data: resultDataUrl,
              fileExtension: '.json',
            },
          ],
          usage: {
            // 可以添加使用量信息，如音频时长等
            ...(duration && { video_duration: duration }),
          },
        };
      }

      // 根据 statusCode 判断任务状态
      // 20000001: 正在处理中
      // 20000002: 任务在队列中
      if (statusCodeNum === 20000001 || statusCodeNum === 20000002) {
        console.log(`[${this.name}] Task processing (status code: ${statusCodeNum}), returning processing status`);
        return {
          status: 'processing',
        };
      }

      // 如果 statusCode 存在但不是已知的状态码，根据范围判断
      if (statusCodeNum !== null) {
        // 4xxxx 表示客户端错误
        if (statusCodeNum >= 40000000 && statusCodeNum < 50000000) {
          console.error(`[${this.name}] Client error (status code: ${statusCodeNum})`);
          return {
            status: 'failed',
            error: message || `Client error (code: ${statusCodeNum})`,
          };
        }
        // 5xxxx 表示服务器错误
        if (statusCodeNum >= 50000000 && statusCodeNum < 60000000) {
          console.error(`[${this.name}] Server error (status code: ${statusCodeNum})`);
          return {
            status: 'failed',
            error: message || `Server error (code: ${statusCodeNum})`,
          };
        }
      }

      // 任务还在处理中，返回 pending 或 processing 状态，外部框架会继续轮询
      console.log(`[${this.name}] Task still processing (statusCode: ${statusCodeNum ?? statusCode ?? 'undefined'}), returning processing status`);
      return {
        status: 'processing',
      };
    } catch (error) {
      console.error(`[${this.name}] Query task failed:`, error);
      throw error;
    }
  }

  calculateCost(params: z.infer<typeof this.paramsSchema>, outputs: GenerationTaskResult): number {
    // 字节跳动 OpenSpeech 的计费方式需要根据实际API文档确定
    // 这里暂时返回 0，表示按实际使用量计费
    return 0;
  }

  /**
   * 获取支持的语言列表
   * 字节跳动 OpenSpeech 支持的语言代码
   */
  async getSupportedLanguages(): Promise<Array<{ code: string; name: string }>> {
    return [
      { code: 'zh', name: '中文' },
      { code: 'en', name: 'English' },
      { code: 'ja', name: '日本語' },
      { code: 'ko', name: '한국어' },
      { code: 'es', name: 'Español' },
      { code: 'fr', name: 'Français' },
      { code: 'de', name: 'Deutsch' },
      { code: 'it', name: 'Italiano' },
      { code: 'pt', name: 'Português' },
      { code: 'ru', name: 'Русский' },
      { code: 'ar', name: 'العربية' },
      { code: 'hi', name: 'हिन्दी' },
      { code: 'th', name: 'ไทย' },
      { code: 'vi', name: 'Tiếng Việt' },
      { code: 'id', name: 'Bahasa Indonesia' },
      { code: 'tr', name: 'Türkçe' },
      { code: 'pl', name: 'Polski' },
      { code: 'nl', name: 'Nederlands' },
      { code: 'cs', name: 'Čeština' },
      { code: 'sv', name: 'Svenska' },
      { code: 'da', name: 'Dansk' },
      { code: 'fi', name: 'Suomi' },
      { code: 'no', name: 'Norsk' },
      { code: 'el', name: 'Ελληνικά' },
      { code: 'he', name: 'עברית' },
      { code: 'ms', name: 'Bahasa Melayu' },
      { code: 'ro', name: 'Română' },
      { code: 'hu', name: 'Magyar' },
      { code: 'uk', name: 'Українська' },
      { code: 'bg', name: 'Български' },
      { code: 'hr', name: 'Hrvatski' },
      { code: 'sk', name: 'Slovenčina' },
      { code: 'sl', name: 'Slovenščina' },
      { code: 'ca', name: 'Català' },
      { code: 'ta', name: 'தமிழ்' },
      { code: 'af', name: 'Afrikaans' },
    ];
  }
}
