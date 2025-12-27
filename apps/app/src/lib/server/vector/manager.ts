/**
 * 向量库管理器
 * 支持管理多个向量库实例
 */

import type { VectorProvider, VectorProviderConfig } from './types';
import { UpstashVectorProvider, type UpstashVectorConfig } from './providers/upstash';

/**
 * 向量库管理器
 */
export class VectorManager {
  private providers: Map<string, VectorProvider> = new Map();
  private initialized = false;

  /**
   * 确保已初始化（延迟初始化，只在首次使用时初始化）
   */
  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }

    this.initializeFromEnv();
    this.initialized = true;
  }

  /**
   * 从环境变量初始化向量库
   * 支持多个向量库配置，格式：
   * VECTOR_PROVIDERS='[{"type":"upstash","name":"snippets","config":{"url":"...","token":"..."}}, ...]'
   *
   * 或者使用简化的环境变量（向后兼容）：
   * UPSTASH_VECTOR_REST_URL, UPSTASH_VECTOR_REST_TOKEN
   */
  private initializeFromEnv(): void {
    // 方式1: 使用 JSON 配置（支持多个向量库）
    const providersConfig = process.env.VECTOR_PROVIDERS;
    if (providersConfig) {
      try {
        const configs: VectorProviderConfig[] = JSON.parse(providersConfig);
        for (const config of configs) {
          this.registerFromConfig(config);
        }
        console.log(`[VectorManager] ✅ 从 VECTOR_PROVIDERS 初始化了 ${configs.length} 个向量库`);
        return;
      } catch (error) {
        console.error('[VectorManager] ❌ 解析 VECTOR_PROVIDERS 失败:', error);
      }
    }

    // 方式2: 使用简化的环境变量（向后兼容，默认注册为 'default'）
    const upstashUrl = process.env.UPSTASH_VECTOR_REST_URL;
    const upstashToken = process.env.UPSTASH_VECTOR_REST_TOKEN;

    if (upstashUrl && upstashToken) {
      this.registerFromConfig({
        type: 'upstash',
        name: 'default',
        enabled: true,
        config: {
          url: upstashUrl,
          token: upstashToken,
        },
      });
      console.log('[VectorManager] ✅ 从环境变量初始化了 Upstash Vector (default)');
    }
  }

  /**
   * 注册向量库提供者
   */
  registerProvider(provider: VectorProvider): void {
    const key = `${provider.type}:${provider.name}`;
    if (this.providers.has(key)) {
      console.warn(`[VectorManager] ⚠️ 向量库 ${key} 已存在，将被覆盖`);
    }
    this.providers.set(key, provider);
    console.log(`[VectorManager] ✅ 已注册向量库: ${key}`);
  }

  /**
   * 从配置创建并注册向量库提供者
   */
  registerFromConfig(config: VectorProviderConfig): void {
    if (config.enabled === false) {
      console.log(`[VectorManager] ⏭️ 向量库 ${config.type}:${config.name} 已禁用，跳过注册`);
      return;
    }

    let provider: VectorProvider;

    switch (config.type) {
      case 'upstash':
        provider = new UpstashVectorProvider(config.name, config.config as UpstashVectorConfig);
        break;
      // 未来可以添加其他向量库类型
      // case 'pinecone':
      //   provider = new PineconeVectorProvider(config.name, config.config as PineconeVectorConfig);
      //   break;
      // case 'weaviate':
      //   provider = new WeaviateVectorProvider(config.name, config.config as WeaviateVectorConfig);
      //   break;
      default:
        console.warn(`[VectorManager] ⚠️ 不支持的向量库类型: ${config.type}`);
        return;
    }

    this.registerProvider(provider);
  }

  /**
   * 获取向量库提供者
   * @param type 向量库类型
   * @param name 向量库名称（可选，默认 'default'）
   */
  getProvider(type: string, name: string = 'default'): VectorProvider | undefined {
    this.ensureInitialized();
    const key = `${type}:${name}`;
    return this.providers.get(key);
  }

  /**
   * 获取所有可用的向量库提供者
   */
  getAllProviders(): VectorProvider[] {
    this.ensureInitialized();
    return Array.from(this.providers.values());
  }

  /**
   * 获取指定类型的所有向量库提供者
   */
  getProvidersByType(type: string): VectorProvider[] {
    this.ensureInitialized();
    return Array.from(this.providers.values()).filter(p => p.type === type);
  }

  /**
   * 检查向量库是否可用
   */
  isAvailable(type: string, name: string = 'default'): boolean {
    this.ensureInitialized();
    const provider = this.getProvider(type, name);
    return provider ? provider.isAvailable() : false;
  }
}

// 导出已初始化的单例（Node.js 模块单例特性保证只执行一次）
export const vectorManager = new VectorManager();
