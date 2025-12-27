import { BaseSearchProvider } from './base';
import type { SearchParams, SearchResult } from '../types';

/**
 * SerpAPI 搜索提供者
 * 需要配置 SERPAPI_API_KEY 环境变量
 */
export class SerpAPIProvider extends BaseSearchProvider {
  constructor(apiKey?: string) {
    super('SerpAPI', {
      enabled: true,
      priority: 50, // 中等优先级
      apiKey: apiKey || process.env.SERPAPI_API_KEY,
    });
  }

  isAvailable(): boolean {
    return this.config.enabled && !!this.config.apiKey;
  }

  async search(params: SearchParams): Promise<SearchResult[]> {
    this.validateParams(params);

    if (!this.config.apiKey) {
      throw new Error('SerpAPI API key is not configured');
    }

    const { query, maxResults } = params;

    try {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${this.config.apiKey}&num=${maxResults}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`SerpAPI error! status: ${response.status}`);
      }

      const data = await response.json();
      const results: SearchResult[] = [];

      if (data.organic_results && Array.isArray(data.organic_results)) {
        for (const result of data.organic_results.slice(0, maxResults)) {
          results.push({
            title: result.title,
            snippet: result.snippet,
            url: result.link,
            source: 'Google (via SerpAPI)',
          });
        }
      }

      return results;
    } catch (error) {
      console.error('[WebSearch] SerpAPI search error:', error);
      throw error;
    }
  }
}

