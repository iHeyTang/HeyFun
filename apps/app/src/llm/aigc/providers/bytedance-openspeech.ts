import z from 'zod';
import { randomUUID } from 'crypto';

export const bytedanceOpenspeechServiceConfigSchema = z.object({
  appid: z.string(),
  token: z.string(),
});

export class BytedanceOpenspeechProvider {
  public readonly appid: string;
  private readonly token: string;
  public readonly serviceUrl: string;

  constructor(config: z.infer<typeof bytedanceOpenspeechServiceConfigSchema>) {
    this.appid = config.appid;
    this.token = config.token;
    this.serviceUrl = 'https://openspeech.bytedance.com';
  }

  /**
   * 通用请求方法，只提供基础的 headers 和 URL
   * @param method HTTP 方法
   * @param path API 路径
   * @param body 请求体
   * @param additionalHeaders 额外的请求头
   * @returns 返回响应数据和响应头
   */
  async request<T>(
    method: string,
    path: string,
    body?: any,
    additionalHeaders?: Record<string, string>,
  ): Promise<{ data: T; headers: Record<string, string> }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.token,
      'X-Api-Sequence': '-1',
      ...additionalHeaders,
    };

    const response = await fetch(`${this.serviceUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // 提取响应头
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.statusText}`;
      try {
        const errorBody = await response.text();
        if (errorBody) {
          try {
            const errorJson = JSON.parse(errorBody);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch {
            errorMessage = `${errorMessage}. Response: ${errorBody}`;
          }
        }
      } catch (e) {
        throw e;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return { data: data as T, headers: responseHeaders };
  }
}
