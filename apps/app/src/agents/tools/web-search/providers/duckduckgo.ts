import { BaseSearchProvider } from './base';
import type { SearchParams, SearchResult } from '../types';

/**
 * DuckDuckGo 搜索提供者
 * 提供免费的搜索 API，无需 API key
 */
export class DuckDuckGoProvider extends BaseSearchProvider {
  constructor() {
    super('DuckDuckGo', {
      enabled: true,
      priority: 100, // 最低优先级，作为备用
    });
  }

  isAvailable(): boolean {
    // DuckDuckGo 始终可用（不需要 API key）
    return this.config.enabled;
  }

  async search(params: SearchParams): Promise<SearchResult[]> {
    this.validateParams(params);
    const { query, maxResults } = params;

    try {
      // 首先尝试使用 HTML 搜索接口并解析结果
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const results: SearchResult[] = [];

      // 解析 HTML 搜索结果
      const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
      const snippetPattern = /<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/gi;

      let match;
      const links: Array<{ url: string; title: string }> = [];

      // 提取链接和标题
      while ((match = resultPattern.exec(html)) !== null && links.length < maxResults) {
        const url = match[1];
        const title = match[2]?.trim();
        if (url && title) {
          links.push({ url, title });
        }
      }

      // 提取摘要
      const snippets: string[] = [];
      while ((match = snippetPattern.exec(html)) !== null && snippets.length < maxResults) {
        snippets.push(match[1]?.trim() || '');
      }

      // 组合结果
      for (let i = 0; i < Math.min(links.length, maxResults); i++) {
        const link = links[i];
        if (link) {
          results.push({
            title: link.title,
            snippet: snippets[i] || link.title,
            url: link.url,
            source: 'DuckDuckGo',
          });
        }
      }

      // 如果 HTML 解析没有结果，尝试使用 Instant Answer API 作为备用
      if (results.length === 0) {
        const instantAnswerUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const iaResponse = await fetch(instantAnswerUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (iaResponse.ok) {
          const data = await iaResponse.json();

          if (data.AbstractText) {
            results.push({
              title: data.Heading || data.AbstractText.substring(0, 50),
              snippet: data.AbstractText,
              url: data.AbstractURL,
              source: 'DuckDuckGo Instant Answer',
            });
          }

          if (data.Answer && results.length === 0) {
            results.push({
              title: data.Heading || 'Answer',
              snippet: data.Answer,
              url: data.AbstractURL,
              source: 'DuckDuckGo Answer',
            });
          }

          // 添加相关主题
          if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
            for (const topic of data.RelatedTopics.slice(0, maxResults - results.length)) {
              if (topic.Text && topic.FirstURL) {
                results.push({
                  title: topic.Text.substring(0, 100),
                  snippet: topic.Text,
                  url: topic.FirstURL,
                  source: 'DuckDuckGo Related',
                });
              }
            }
          }
        }
      }

      return results;
    } catch (error) {
      console.error('[WebSearch] DuckDuckGo search error:', error);
      throw error;
    }
  }
}

