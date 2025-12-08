import { UnifiedChat } from './types';
import { createProvider, BaseProvider } from './providers';
import { getAdapter, BaseAdapter } from './adapters';
import { ModelInfo } from './models';

export interface ChatClientConfig {
  modelId: string;
  apiKey?: string;
  models?: ModelInfo[]; // 模型列表（从数据库加载）
  timeout?: number;
  maxRetries?: number;
  [key: string]: any;
}

export class ChatClient {
  private modelDef: ModelInfo;
  private provider: BaseProvider;
  private adapter: BaseAdapter;

  public totalInputTokens: number = 0;
  public totalCompletionTokens: number = 0;

  constructor(private config: ChatClientConfig) {
    const models = config.models || [];
    const model = models.find(m => m.id === config.modelId);
    if (!model) throw new Error(`Model not found: ${config.modelId}`);
    this.modelDef = model;

    const providerId = (model.metadata?.providerId as string) || model.provider;
    const adapterType = (model.metadata?.adapterType as string) || 'openai';

    this.provider = createProvider(providerId, {
      apiKey: config.apiKey,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      ...config,
    });

    this.adapter = getAdapter(adapterType);
  }

  async chat(params: UnifiedChat.ChatCompletionParams): Promise<UnifiedChat.ChatCompletion> {
    const providerModelId = (this.modelDef.metadata?.providerModelId as string) || this.modelDef.id;
    const providerRequest = this.adapter.formatRequest(params, providerModelId);
    const endpoint = this.adapter.getChatEndpoint();
    const httpRequest = this.provider.buildRequest(endpoint, providerRequest, this.config.apiKey);
    const response = await this.provider.sendRequest(httpRequest);

    if (response.status !== 200) {
      throw new Error(`API error (${response.status}): ${JSON.stringify(response.body)}`);
    }

    const result = this.adapter.parseResponse(response.body, this.modelDef.id);
    if (result.usage) {
      this.totalInputTokens += result.usage.prompt_tokens || 0;
      this.totalCompletionTokens += result.usage.completion_tokens || 0;
    }
    return result;
  }

  async *chatStream(params: UnifiedChat.ChatCompletionParams): AsyncIterableIterator<UnifiedChat.ChatCompletionChunk> {
    if (!this.modelDef.supportsStreaming || !this.adapter.supportsStreaming()) {
      throw new Error(`Model ${this.modelDef.id} does not support streaming`);
    }

    const providerModelId = (this.modelDef.metadata?.providerModelId as string) || this.modelDef.id;
    const streamParams = { ...params, stream: true };
    const providerRequest = this.adapter.formatRequest(streamParams, providerModelId);
    const endpoint = this.adapter.getChatEndpoint();
    const httpRequest = this.provider.buildRequest(endpoint, providerRequest, this.config.apiKey);
    const stream = this.provider.sendStreamRequest(httpRequest);

    for await (const chunk of stream) {
      const parsedChunk = this.adapter.parseStreamChunk(chunk, this.modelDef.id);
      if (parsedChunk) {
        if (parsedChunk.usage) {
          this.totalInputTokens += parsedChunk.usage.prompt_tokens || 0;
          this.totalCompletionTokens += parsedChunk.usage.completion_tokens || 0;
        }
        yield parsedChunk;
      }
    }
  }

  getModelDefinition(): ModelInfo {
    return { ...this.modelDef };
  }

  getCapabilities() {
    return {
      streaming: this.modelDef.supportsStreaming,
      tools: this.modelDef.supportsFunctionCalling,
      vision: this.modelDef.supportsVision,
    };
  }

  getPricing() {
    return { ...this.modelDef.pricing };
  }

  updateConfig(config: Partial<ChatClientConfig>): void {
    Object.assign(this.config, config);
    if (config.apiKey || config.timeout || config.maxRetries) {
      this.provider.updateConfig({
        apiKey: config.apiKey,
        timeout: config.timeout,
        maxRetries: config.maxRetries,
      });
    }
  }

  resetTokenCount(): void {
    this.totalInputTokens = 0;
    this.totalCompletionTokens = 0;
  }

  getTotalTokens(): number {
    return this.totalInputTokens + this.totalCompletionTokens;
  }
}

export function createChatClient(config: ChatClientConfig): ChatClient {
  return new ChatClient(config);
}
