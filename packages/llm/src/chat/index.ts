/**
 * Chat - 三层解耦架构
 * Provider（提供商）/ Adapter（协议适配）/ Model（模型配置）
 */

import { ChatClient, createChatClient } from './client';
import { ModelRegistry } from './models';
import type { ModelInfo, ModelFilter } from './models';
import type { ProviderConfig } from './providers';

// ============ 导出类型 ============
export type { UnifiedChat } from './types';
export type { ProviderConfig } from './providers';
export type { ModelInfo, ModelPricing, ModelFilter } from './models';
export type { ChatClientConfig } from './client';

// ============ 导出类和函数 ============
export {
  BaseProvider,
  OpenAIProvider,
  AnthropicProvider,
  OpenRouterProvider,
  DeepSeekProvider,
  createProvider,
  getAvailableProviders,
} from './providers';

export { ModelRegistry } from './models';

export { ChatClient, createChatClient } from './client';

// ============ ChatHost 主机类 ============

export interface ChatHostConfig {
  openai?: ProviderConfig;
  anthropic?: ProviderConfig;
  openrouter?: ProviderConfig;
  deepseek?: ProviderConfig;
  google?: ProviderConfig;
  vercel?: ProviderConfig;
}

export class ChatHost {
  private providerConfigs: Map<string, ProviderConfig> = new Map();
  private models: ModelInfo[] = [];

  constructor(config: ChatHostConfig, models: ModelInfo[] = []) {
    this.models = models;

    if (config.openai) this.providerConfigs.set('openai', config.openai);
    if (config.anthropic) this.providerConfigs.set('anthropic', config.anthropic);
    if (config.openrouter) this.providerConfigs.set('openrouter', config.openrouter);
    if (config.deepseek) this.providerConfigs.set('deepseek', config.deepseek);
    if (config.google) this.providerConfigs.set('google', config.google);
    if (config.vercel) this.providerConfigs.set('vercel', config.vercel);
  }

  /**
   * 设置模型列表（从数据库加载）
   */
  setModels(models: ModelInfo[]): void {
    this.models = models;
  }

  createClient(modelId: string, overrideConfig?: Partial<ProviderConfig>): ChatClient {
    const modelDef = ModelRegistry.getModel(this.models, modelId);
    if (!modelDef) throw new Error(`Model not found: ${modelId}`);

    const providerId = (modelDef.metadata?.providerId as string) || modelDef.provider;
    const providerConfig = this.providerConfigs.get(providerId);
    if (!providerConfig) {
      throw new Error(`Provider ${providerId} not configured. Please set API key in ChatHost config or environment variables.`);
    }

    return createChatClient({
      modelId,
      models: this.models,
      ...providerConfig,
      ...overrideConfig,
    });
  }

  getModels(filter?: ModelFilter): ModelInfo[] {
    if (filter) return ModelRegistry.filterModels(this.models, filter);
    return [...this.models];
  }

  getModelInfo(modelId: string): ModelInfo | null {
    return ModelRegistry.getModel(this.models, modelId);
  }

  searchModels(query: string): ModelInfo[] {
    return ModelRegistry.searchModels(this.models, query);
  }

  getFreeModels(): ModelInfo[] {
    return ModelRegistry.getFreeModels(this.models);
  }

  getModelsByFamily(): Map<string, ModelInfo[]> {
    return ModelRegistry.groupByFamily(this.models);
  }

  getModelsByProvider(): Map<string, ModelInfo[]> {
    return ModelRegistry.groupByProvider(this.models);
  }

  hasProvider(providerId: string): boolean {
    return this.providerConfigs.has(providerId);
  }

  getConfiguredProviders(): string[] {
    return Array.from(this.providerConfigs.keys());
  }
}

// ============ 默认实例（从环境变量读取配置）============
// 注意：模型列表需要从数据库加载，使用 setModels() 方法设置

const CHAT = new ChatHost({
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    baseURL: process.env.ANTHROPIC_BASE_URL,
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseURL: process.env.OPENROUTER_BASE_URL,
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: process.env.DEEPSEEK_BASE_URL,
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY || '',
    baseURL: process.env.GOOGLE_BASE_URL,
  },
  vercel: {
    apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY || '',
    baseURL: process.env.VERCEL_AI_GATEWAY_BASE_URL,
  },
});

export default CHAT;
