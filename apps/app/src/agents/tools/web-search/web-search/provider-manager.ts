import type { SearchProvider, SearchParams, SearchResult } from './types';
import { DuckDuckGoProvider } from './providers/duckduckgo';
import { SerpAPIProvider } from './providers/serpapi';
import { BochaProvider } from './providers/bocha';

/**
 * 搜索提供者管理器
 * 负责管理多个搜索提供者，并智能选择可用的提供者进行搜索
 */
export class SearchProviderManager {
  private providers: Map<string, SearchProvider> = new Map();

  constructor() {
    // 初始化所有提供者
    this.registerProvider(new BochaProvider());
    this.registerProvider(new SerpAPIProvider());
    this.registerProvider(new DuckDuckGoProvider());
  }

  /**
   * 注册搜索提供者
   */
  registerProvider(provider: SearchProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * 获取提供者
   * 支持大小写不敏感匹配和 engine 名称映射
   */
  getProvider(name: string): SearchProvider | undefined {
    // 直接匹配
    const directMatch = this.providers.get(name);
    if (directMatch) {
      return directMatch;
    }

    // 大小写不敏感匹配
    const lowerName = name.toLowerCase();
    for (const [key, value] of this.providers.entries()) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }

    // engine 名称映射（支持小写的 engine 名称）
    const engineMap: Record<string, string> = {
      bocha: 'Bocha',
      serpapi: 'SerpAPI',
      duckduckgo: 'DuckDuckGo',
    };

    const mappedName = engineMap[lowerName];
    if (mappedName) {
      return this.providers.get(mappedName);
    }

    return undefined;
  }

  /**
   * 获取所有可用的提供者（按优先级排序）
   */
  getAvailableProviders(): SearchProvider[] {
    return Array.from(this.providers.values())
      .filter(p => p.isAvailable())
      .sort((a, b) => a.getConfig().priority - b.getConfig().priority);
  }

  /**
   * 执行搜索，自动选择最优提供者
   * @param params 搜索参数
   * @param providerName 可选，指定使用哪个提供者。如果不指定，则使用优先级最高的可用提供者
   */
  async search(
    params: SearchParams,
    providerName?: string,
  ): Promise<{ results: SearchResult[]; provider: string }> {
    let provider: SearchProvider | undefined;

    if (providerName) {
      // 使用指定的提供者（支持 engine 名称映射）
      provider = this.getProvider(providerName);
      if (!provider) {
        throw new Error(`Provider "${providerName}" not found`);
      }
      if (!provider.isAvailable()) {
        throw new Error(`Provider "${providerName}" is not available`);
      }
    } else {
      // 自动选择最优提供者（优先级最高且可用）
      const availableProviders = this.getAvailableProviders();
      if (availableProviders.length === 0) {
        throw new Error('No available search providers');
      }
      provider = availableProviders[0]!; // 已检查长度，保证非空
    }

    // provider 此时一定非空（要么从指定名称获取，要么从可用列表中获取）
    if (!provider) {
      throw new Error('Provider is not available');
    }

    try {
      const results = await provider.search(params);
      return {
        results,
        provider: provider.name,
      };
    } catch (error) {
      // 如果指定了提供者且失败，直接抛出错误
      if (providerName) {
        throw error;
      }

      // 如果自动选择的提供者失败，尝试其他可用的提供者作为降级
      const availableProviders = this.getAvailableProviders();
      const fallbackProviders = availableProviders.filter(p => p.name !== provider?.name);

      for (const fallbackProvider of fallbackProviders) {
        try {
          console.warn(`[WebSearch] Provider "${provider?.name}" failed, trying fallback "${fallbackProvider.name}"`);
          const results = await fallbackProvider.search(params);
          return {
            results,
            provider: fallbackProvider.name,
          };
        } catch (fallbackError) {
          console.error(`[WebSearch] Fallback provider "${fallbackProvider.name}" also failed:`, fallbackError);
          // 继续尝试下一个
        }
      }

      // 所有提供者都失败了
      throw new Error(`All search providers failed. Last error: ${(error as Error).message}`);
    }
  }

  /**
   * 使用多个提供者并行搜索并合并结果
   * @param params 搜索参数
   * @param maxProviders 最多使用多少个提供者
   */
  async searchMultiple(
    params: SearchParams,
    maxProviders: number = 2,
  ): Promise<{ results: SearchResult[]; providers: string[] }> {
    const availableProviders = this.getAvailableProviders().slice(0, maxProviders);

    if (availableProviders.length === 0) {
      throw new Error('No available search providers');
    }

    // 并行搜索
    const searchPromises = availableProviders.map(async provider => {
      try {
        const results = await provider.search(params);
        return { provider: provider.name, results, success: true };
      } catch (error) {
        console.error(`[WebSearch] Provider "${provider.name}" search failed:`, error);
        return { provider: provider.name, results: [], success: false };
      }
    });

    const searchResults = await Promise.allSettled(searchPromises);

    // 合并结果
    const allResults: SearchResult[] = [];
    const usedProviders: string[] = [];

    for (const result of searchResults) {
      if (result.status === 'fulfilled' && result.value.success) {
        allResults.push(...result.value.results);
        usedProviders.push(result.value.provider);
      }
    }

    // 去重（基于URL）
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.url, item])).values(),
    ).slice(0, params.maxResults);

    return {
      results: uniqueResults,
      providers: usedProviders,
    };
  }

  /**
   * 获取所有提供者的状态
   */
  getProvidersStatus(): Array<{ name: string; available: boolean; priority: number }> {
    return Array.from(this.providers.values()).map(p => ({
      name: p.name,
      available: p.isAvailable(),
      priority: p.getConfig().priority,
    }));
  }
}

// 创建全局单例
export const searchProviderManager = new SearchProviderManager();

