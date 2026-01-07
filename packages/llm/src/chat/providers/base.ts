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

  /**
   * Embedding 接口（与 LangChain 兼容）
   * 子类可以覆盖此方法以使用 LangChain 或其他实现
   */

  /**
   * 嵌入文档（批量）
   * 与 LangChain Embeddings.embedDocuments 接口兼容
   * @param texts 文本数组
   * @param model 可选的模型名称
   * @returns 向量嵌入数组
   */
  async embedDocuments(texts: string[], model?: string): Promise<number[][]> {
    // 默认实现：逐个调用 embedQuery
    // 子类可以覆盖以使用批量 API 或 LangChain
    const embeddings: number[][] = [];
    for (const text of texts) {
      const embedding = await this.embedQuery(text, model);
      embeddings.push(embedding);
    }
    return embeddings;
  }

  /**
   * 嵌入查询（单个）
   * 与 LangChain Embeddings.embedQuery 接口兼容
   * @param text 查询文本
   * @param model 可选的模型名称
   * @returns 向量嵌入
   */
  async embedQuery(text: string, model?: string): Promise<number[]> {
    // 默认实现：使用 HTTP 请求调用 embedding API
    // 子类可以覆盖以使用 LangChain 或其他实现
    const embeddingRequest = {
      model: model || this.getDefaultEmbeddingModel(),
      input: text,
      encoding_format: 'float' as const,
    };

    const request = this.buildRequest('/embeddings', embeddingRequest);
    const response = await this.sendRequest(request);

    if (response.status !== 200) {
      throw new Error(`Embedding API error (${response.status}): ${JSON.stringify(response.body)}`);
    }

    // 解析响应（OpenAI 兼容格式）
    const body = response.body;
    if (body.data && Array.isArray(body.data) && body.data.length > 0) {
      const embedding = body.data[0].embedding;
      if (Array.isArray(embedding)) {
        return embedding as number[];
      }
    }

    throw new Error('Invalid embedding response format');
  }

  /**
   * 获取默认的 embedding 模型名称
   * 子类可以覆盖以提供 provider 特定的默认模型
   */
  protected getDefaultEmbeddingModel(): string {
    return 'text-embedding-3-small';
  }
}
