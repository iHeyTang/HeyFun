import z from 'zod';
import { downloadFile } from '../utils/downloader';

export const murekaServiceConfigSchema = z.object({
  apiKey: z.string().min(1),
});

export type MurekaRequestParams<T> = {
  path: string;
  method: 'GET' | 'POST';
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: T;
};

const BASE_URL = 'https://api.mureka.ai';

export class MurekaProvider {
  private readonly apiKey: string;

  constructor(config: z.infer<typeof murekaServiceConfigSchema>) {
    this.apiKey = config.apiKey;
  }

  async request<R = unknown, T = unknown>(params: MurekaRequestParams<T>): Promise<R> {
    const url = new URL(`${BASE_URL}${params.path}`);
    const query = new URLSearchParams(params.query);
    url.search = query.toString();
    try {
      const response = await fetch(url, {
        method: params.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...params.headers,
        },
        body: params.body ? JSON.stringify(params.body) : undefined,
      });
      return response.json() as Promise<R>;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * 上传文件到 Mureka API
   *
   * @param params 文件上传参数
   * @param params.file 文件URL
   * @param params.purpose 文件用途类型：
   *   - reference: 支持格式 (mp3, m4a)，音频时长范围 [30,30] 秒，超出部分将被裁剪
   *   - vocal: 支持格式 (mp3, m4a)，使用上传音频中提取的人声，人声时长范围 [15,30] 秒，超出部分将被裁剪
   *   - melody: 支持格式 (mp3, m4a, mid)，使用上传音频中提取的人声，建议上传MIDI文件，音频时长范围 [5,60] 秒，超出部分将被裁剪
   *   - instrumental: 支持格式 (mp3, m4a)，音频时长范围 [30,30] 秒，超出部分将被裁剪
   *   - voice: 支持格式 (mp3, m4a)，音频时长范围 [5,15] 秒，超出部分将被裁剪
   *   - audio: 支持格式 (mp3, m4a)，通用音频文件，用于歌曲扩展等类似用途
   * @returns Promise<string> 返回上传后的文件ID
   */
  async uploadFile(params: {
    file: string;
    purpose: 'reference' | 'vocal' | 'melody' | 'instrumental' | 'voice' | 'audio';
  }): Promise<{ id: string; bytes: number; created_at: number; filename: string; purpose: string }> {
    const fileUrl = new URL(params.file);
    const filename = fileUrl.pathname.split('/').pop();
    const buffer = await downloadFile(params.file);

    const formData = new FormData();
    formData.append('file', new Blob([buffer]), filename);
    formData.append('purpose', params.purpose);

    const url = new URL(`${BASE_URL}/v1/files/upload`);
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    return response.json() as Promise<{ id: string; bytes: number; created_at: number; filename: string; purpose: string }>;
  }
}
