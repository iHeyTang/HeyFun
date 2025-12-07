/**
 * Provider 基础接口
 * Provider 只关心：鉴权、API 配置、HTTP 请求构建
 * 不关心：请求/响应的具体格式（由 Adapter 处理）
 */

export interface ProviderConfig {
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  [key: string]: any;
}

export interface HTTPRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  body?: any;
}

export interface HTTPResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

/**
 * Provider 抽象类
 */
export abstract class BaseProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly baseURL: string;

  constructor(protected config: ProviderConfig = {}) {}

  /**
   * 构建认证 headers
   */
  abstract buildAuthHeaders(apiKey?: string): Record<string, string>;

  /**
   * 构建完整的 HTTP 请求
   */
  buildRequest(endpoint: string, body: any, apiKey?: string): HTTPRequest {
    const url = `${this.config.baseURL || this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.buildAuthHeaders(apiKey || this.config.apiKey),
      ...this.getExtraHeaders(),
    };

    return {
      url,
      method: 'POST',
      headers,
      body,
    };
  }

  /**
   * 获取额外的 headers（子类可以覆盖）
   */
  protected getExtraHeaders(): Record<string, string> {
    return {};
  }

  /**
   * 发送 HTTP 请求
   */
  async sendRequest(request: HTTPRequest): Promise<HTTPResponse> {
    try {
      console.log(`[${this.name}] Sending request to: ${request.url}`);
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: this.config.timeout ? AbortSignal.timeout(this.config.timeout) : undefined,
      });

      const body = await response.json().catch(() => null);

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      if (response.status !== 200) {
        console.error(`[${this.name}] Request failed with status ${response.status}:`, JSON.stringify(body));
      }

      return {
        status: response.status,
        headers,
        body,
      };
    } catch (error) {
      console.error(`[${this.name}] sendRequest error:`, error);
      throw error;
    }
  }

  /**
   * 发送流式请求
   */
  async *sendStreamRequest(request: HTTPRequest): AsyncIterableIterator<any> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
      signal: this.config.timeout ? AbortSignal.timeout(this.config.timeout) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              yield data;
            } catch (e) {
              console.warn('Failed to parse SSE data:', trimmed);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): ProviderConfig {
    return { ...this.config };
  }
}
