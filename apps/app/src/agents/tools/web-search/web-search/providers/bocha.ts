import { BaseSearchProvider } from './base';
import type { SearchParams, SearchResult } from '../types';
import type { BochaWebSearchRequest, BochaWebSearchResponse } from './bocha-types';

/**
 * 博查API 搜索提供者
 * 需要配置 BOCHA_API_KEY 和 BOCHA_API_URL 环境变量
 * API文档: https://bocha-ai.feishu.cn/wiki/RXEOw02rFiwzGSkd9mUcqoeAnNK
 */
export class BochaProvider extends BaseSearchProvider {
  constructor(apiKey?: string, apiUrl?: string) {
    super('Bocha', {
      enabled: true,
      priority: 10, // 高优先级
      apiKey: apiKey || process.env.BOCHA_API_KEY,
      apiUrl: apiUrl || process.env.BOCHA_API_URL || 'https://api.bocha.cn/v1/web-search',
    });
  }

  isAvailable(): boolean {
    return this.config.enabled && !!this.config.apiKey && !!this.config.apiUrl;
  }

  async search(params: SearchParams): Promise<SearchResult[]> {
    this.validateParams(params);

    if (!this.config.apiKey) {
      throw new Error('Bocha API key is not configured');
    }

    if (!this.config.apiUrl) {
      throw new Error('Bocha API URL is not configured');
    }

    const { query, maxResults } = params;

    try {
      // 构建符合OpenAPI规范的请求体
      const requestBody: BochaWebSearchRequest = {
        query,
        count: Math.min(maxResults, 50), // API限制最大50
        summary: true, // 启用摘要
        freshness: 'noLimit', // 默认不限制时间范围
      };

      const response = await fetch(this.config.apiUrl as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Bocha API error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage += `, message: ${errorData.msg || errorData.message || errorData.error || errorText}`;
        } catch {
          errorMessage += `, message: ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const apiResponse: BochaWebSearchResponse = await response.json();

      // 检查响应状态码
      if (apiResponse.code !== 200) {
        throw new Error(`Bocha API error! code: ${apiResponse.code}, msg: ${apiResponse.msg || 'Unknown error'}`);
      }

      // 解析响应数据
      const results: SearchResult[] = [];

      if (apiResponse.data?.webPages?.value && Array.isArray(apiResponse.data.webPages.value)) {
        for (const item of apiResponse.data.webPages.value.slice(0, maxResults)) {
          results.push({
            title: item.name || '',
            snippet: item.summary || item.snippet || '',
            url: item.url || '',
            source: 'Bocha',
            // 保留额外字段供后续使用
            displayUrl: item.displayUrl,
            siteName: item.siteName,
            datePublished: item.datePublished,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('[WebSearch] Bocha search error:', error);
      throw error;
    }
  }
}
