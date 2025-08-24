/**
 * 通用API适配器 - 处理不同服务商的API调用
 */
import { ServiceAdapter, ModelProviderConfig } from './types';
import { Chat } from '../../models/types';

export interface ApiAdapter {
  sendChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<Chat.ChatCompletion>;
  sendStreamingChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<AsyncIterableIterator<Chat.ChatCompletionChunk>>;
}

/**
 * 通用API适配器实现
 */
export class UniversalApiAdapter implements ApiAdapter {
  private adapter: ServiceAdapter;
  private modelConfig: ModelProviderConfig;

  constructor(adapter: ServiceAdapter, modelConfig: ModelProviderConfig) {
    this.adapter = adapter;
    this.modelConfig = modelConfig;
  }

  async sendChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<Chat.ChatCompletion> {
    const url = this.buildRequestUrl();
    const headers = this.buildHeaders();
    const body = this.transformRequest(params);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.transformResponse(data);
  }

  async sendStreamingChatCompletion(params: Chat.ChatCompletionCreateParams): Promise<AsyncIterableIterator<Chat.ChatCompletionChunk>> {
    const url = this.buildRequestUrl();
    const headers = this.buildHeaders();
    const body = this.transformRequest({ ...params, stream: true });

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API streaming request failed: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    return this.parseStreamResponse(response.body);
  }

  private buildRequestUrl(): string {
    const baseUrl = process.env[this.adapter.env.baseUrl!] || this.adapter.baseUrl;
    const endpoint = this.adapter.apiConfig.chatCompletionEndpoint.replace('{model}', this.modelConfig.modelId);
    
    // 对于需要在URL中传递API密钥的服务（如Google）
    if (this.adapter.authMethod === 'api-key' && this.adapter.id === 'google') {
      const apiKey = process.env[this.adapter.env.apiKey];
      return `${baseUrl}${endpoint}?key=${apiKey}`;
    }
    
    return `${baseUrl}${endpoint}`;
  }

  private buildHeaders(): Record<string, string> {
    const headers = { ...(this.adapter.apiConfig.headers || {}) };
    const apiKey = process.env[this.adapter.env.apiKey];

    if (!apiKey) {
      throw new Error(`API key not found for ${this.adapter.name}`);
    }

    // 根据认证方式添加授权头
    switch (this.adapter.authMethod) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'api-key':
        if (this.adapter.id === 'anthropic') {
          headers['x-api-key'] = apiKey;
        }
        break;
    }

    return headers;
  }

  private transformRequest(params: Chat.ChatCompletionCreateParams): any {
    const transformName = this.adapter.apiConfig.requestTransform;
    
    if (transformName && RequestTransforms[transformName]) {
      return RequestTransforms[transformName](params, this.modelConfig.modelId);
    }

    // 默认OpenAI格式
    return {
      ...params,
      model: this.modelConfig.modelId,
    };
  }

  private transformResponse(data: any): Chat.ChatCompletion {
    const transformName = this.adapter.apiConfig.responseTransform;
    
    if (transformName && ResponseTransforms[transformName]) {
      return ResponseTransforms[transformName](data, this.modelConfig.modelId);
    }

    // 默认返回（假设已经是OpenAI格式）
    return data;
  }

  private async *parseStreamResponse(stream: ReadableStream): AsyncIterableIterator<Chat.ChatCompletionChunk> {
    const reader = stream.getReader();
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
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              
              // 根据服务商转换流响应
              const transformName = this.adapter.apiConfig.responseTransform;
              if (transformName && StreamTransforms[transformName]) {
                const chunk = StreamTransforms[transformName](parsed, this.modelConfig.modelId);
                if (chunk) yield chunk;
              } else {
                // 默认格式（OpenAI）
                yield parsed;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

/**
 * 请求转换函数集合
 */
const RequestTransforms: Record<string, (params: any, modelId: string) => any> = {
  anthropicRequestTransform: (params, modelId) => ({
    model: modelId,
    max_tokens: params.max_tokens || 4000,
    messages: params.messages.filter((m: any) => m.role !== 'system'),
    system: params.messages.find((m: any) => m.role === 'system')?.content || undefined,
    temperature: params.temperature,
    top_p: params.top_p,
    stream: params.stream,
  }),

  googleRequestTransform: (params, modelId) => {
    const contents = params.messages
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : m.content[0]?.text || '' }]
      }));

    // 处理system message
    const systemMessage = params.messages.find((m: any) => m.role === 'system');
    if (systemMessage && contents[0]?.role === 'user') {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
    }

    return {
      contents,
      generationConfig: {
        temperature: params.temperature,
        topP: params.top_p,
        maxOutputTokens: params.max_tokens,
      },
    };
  },
};

/**
 * 响应转换函数集合
 */
const ResponseTransforms: Record<string, (data: any, modelId: string) => Chat.ChatCompletion> = {
  anthropicResponseTransform: (data, modelId) => ({
    id: data.id || `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: modelId,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: data.content?.[0]?.text || '',
        refusal: null,
      },
      logprobs: null,
      finish_reason: data.stop_reason === 'end_turn' ? 'stop' : 'length',
    }],
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
  }),

  googleResponseTransform: (data, modelId) => {
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelId,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content,
          refusal: null,
        },
        logprobs: null,
        finish_reason: candidate?.finishReason === 'STOP' ? 'stop' : 'length',
      }],
      usage: {
        prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  },
};

/**
 * 流响应转换函数集合
 */
const StreamTransforms: Record<string, (data: any, modelId: string) => Chat.ChatCompletionChunk | null> = {
  anthropicResponseTransform: (data, modelId) => {
    if (data.type === 'content_block_delta' && data.delta?.text) {
      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{
          index: 0,
          delta: { content: data.delta.text },
          finish_reason: null,
        }],
      };
    }
    if (data.type === 'message_stop') {
      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
      };
    }
    return null;
  },

  googleResponseTransform: (data, modelId) => {
    const candidate = data.candidates?.[0];
    const delta = candidate?.content?.parts?.[0]?.text || '';

    if (delta) {
      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{
          index: 0,
          delta: { content: delta },
          finish_reason: null,
        }],
      };
    }

    if (candidate?.finishReason === 'STOP') {
      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
      };
    }

    return null;
  },
};