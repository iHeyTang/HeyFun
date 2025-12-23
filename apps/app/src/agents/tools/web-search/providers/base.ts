import type { SearchProvider, SearchProviderConfig, SearchParams, SearchResult } from '../types';

/**
 * 基础搜索提供者抽象类
 */
export abstract class BaseSearchProvider implements SearchProvider {
  protected config: SearchProviderConfig;

  constructor(
    public readonly name: string,
    config: Partial<SearchProviderConfig> = {},
  ) {
    this.config = {
      enabled: true,
      priority: 100,
      ...config,
    };
  }

  abstract isAvailable(): boolean;
  abstract search(params: SearchParams): Promise<SearchResult[]>;

  getConfig(): SearchProviderConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<SearchProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 验证搜索参数
   */
  protected validateParams(params: SearchParams): void {
    if (!params.query || params.query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }
    if (params.maxResults < 1 || params.maxResults > 50) {
      throw new Error('maxResults must be between 1 and 50');
    }
  }
}

