import { BaseProvider, ProviderModelInfo } from './providers/base';
import { BaseModel } from './models/base';
import { getProvider, Provider, getAllProviders } from './providers';
import { getModel } from './models';
import type { Chat } from './models/types';
export type { Provider } from './providers';
export type { ProviderModelInfo } from './providers/base';

export * from './models/types';
export * from './schema';

/**
 * LLM Client Configuration
 */
export interface LLMClientConfig {
  providerId: string;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  [key: string]: any;
}

/**
 * LLM Client - 对外的主要接口类
 * 提供简洁优雅的API，隐藏内部provider和model的复杂性
 */
export class LLMClient {
  private provider!: BaseProvider;
  private model!: BaseModel<any>;
  private config: LLMClientConfig;

  // Token计数器
  public totalInputTokens: number = 0;
  public totalCompletionTokens: number = 0;

  constructor(config: LLMClientConfig) {
    this.config = config;
    this.initializeProviderAndModel();
  }

  /**
   * 初始化provider和model
   * 使用桥接模式：provider提供配置给model
   */
  private async initializeProviderAndModel() {
    // 1. 获取provider实例
    const provider = getProvider(this.config.providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${this.config.providerId}`);
    }
    this.provider = provider;

    // 2. 设置provider配置（包括从数据库获取的apiKey）
    const providerConfig = {
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      ...this.config,
    };
    this.provider.setConfig(providerConfig);

    // 3. 获取model的instruct type
    const models = await this.provider.getModels();
    const targetModel = models.find((m: ProviderModelInfo) => m.id === this.config.modelId);
    if (!targetModel) {
      throw new Error(`Model not found: ${this.config.modelId}`);
    }

    // 4. 创建model实例，传入provider的配置
    const model = getModel(targetModel.architecture.instructType, {
      model: this.config.modelId,
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      ...this.config,
    });

    if (!model) {
      throw new Error(`Model not supported: ${targetModel.architecture.instructType}`);
    }
    this.model = model;
  }

  /**
   * 发送聊天完成请求
   */
  async chat(params: Chat.ChatCompletionCreateParams): Promise<Chat.ChatCompletion> {
    await this.ensureInitialized();
    const response = await this.model.sendChatCompletion(params);

    // 更新token计数器
    if (response.usage) {
      this.totalInputTokens += response.usage.prompt_tokens || 0;
      this.totalCompletionTokens += response.usage.completion_tokens || 0;
    }

    return response;
  }

  /**
   * 发送流式聊天完成请求
   * 自动处理token计数
   */
  async chatStream(params: Chat.ChatCompletionCreateParams): Promise<AsyncIterableIterator<Chat.ChatCompletionChunk>> {
    await this.ensureInitialized();
    const stream = await this.model.sendStreamingChatCompletion(params);

    // 包装流以自动处理token计数
    return this.wrapStreamWithTokenCount(stream);
  }

  /**
   * 包装流以自动处理token计数
   */
  private async *wrapStreamWithTokenCount(stream: AsyncIterableIterator<Chat.ChatCompletionChunk>): AsyncIterableIterator<Chat.ChatCompletionChunk> {
    for await (const chunk of stream) {
      // 检查chunk中是否包含usage信息（通常在最后一个chunk中）
      if (chunk.usage) {
        this.totalInputTokens += chunk.usage.prompt_tokens || 0;
        this.totalCompletionTokens += chunk.usage.completion_tokens || 0;
      }
      yield chunk;
    }
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized() {
    if (!this.model) {
      await this.initializeProviderAndModel();
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): LLMClientConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  async updateConfig(newConfig: Partial<LLMClientConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.initializeProviderAndModel();
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    return this.provider.testConnection();
  }

  /**
   * 获取支持的模型列表
   */
  async getAvailableModels(): Promise<ProviderModelInfo[]> {
    await this.ensureInitialized();
    return this.provider.getModels();
  }

  /**
   * 重置token计数器
   */
  resetTokenCounters(): void {
    this.totalInputTokens = 0;
    this.totalCompletionTokens = 0;
  }

  /**
   * 获取token使用统计
   */
  getTokenUsage(): { inputTokens: number; completionTokens: number; totalTokens: number } {
    return {
      inputTokens: this.totalInputTokens,
      completionTokens: this.totalCompletionTokens,
      totalTokens: this.totalInputTokens + this.totalCompletionTokens,
    };
  }

  /**
   * 手动添加token计数（用于流式响应或其他特殊情况）
   */
  addTokenUsage(inputTokens: number, completionTokens: number): void {
    this.totalInputTokens += inputTokens;
    this.totalCompletionTokens += completionTokens;
  }
}

/**
 * LLM Factory - 工厂类，提供便捷的创建方法
 */
export class LLMFactory {
  /**
   * 创建LLM客户端
   */
  static async create(config: LLMClientConfig): Promise<LLMClient> {
    const client = new LLMClient(config);
    // 确保初始化完成
    await client.testConnection();
    return client;
  }

  /**
   * 获取所有可用的provider
   */
  static getAvailableProviders(): Record<string, Provider> {
    return getAllProviders();
  }

  static getProvider(providerId: string): Provider | null {
    return getProvider(providerId);
  }

  /**
   * 获取指定provider支持的模型
   */
  static async getProviderModels(providerId: string): Promise<ProviderModelInfo[]> {
    const provider = getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }
    return provider.getModels();
  }
}
