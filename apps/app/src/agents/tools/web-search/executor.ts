import { ToolResult } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';

/**
 * 使用 DuckDuckGo 进行网络搜索
 * DuckDuckGo 提供免费的搜索 API，无需 API key
 */
async function searchDuckDuckGo(query: string, maxResults: number = 10): Promise<any> {
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
    const results: any[] = [];

    // 解析 HTML 搜索结果
    // DuckDuckGo 的搜索结果结构
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

/**
 * 使用 SerpAPI 进行搜索（如果配置了 API key）
 */
async function searchSerpAPI(query: string, maxResults: number = 10, apiKey?: string): Promise<any> {
  if (!apiKey) {
    return null;
  }

  try {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${maxResults}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`SerpAPI error! status: ${response.status}`);
    }

    const data = await response.json();
    const results: any[] = [];

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
    return null;
  }
}

export async function webSearchExecutor(args: any, context: ToolContext): Promise<ToolResult> {
  try {
    const { query, maxResults = 10, searchType = 'general' } = args;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return {
        success: false,
        error: 'Search query is required and must be a non-empty string',
      };
    }

    const max = Math.min(Math.max(1, parseInt(String(maxResults)) || 10), 50); // 限制在 1-50 之间

    // 优先尝试 SerpAPI（如果配置了）
    const serpApiKey = process.env.SERPAPI_API_KEY;
    let results = await searchSerpAPI(query, max, serpApiKey);

    // 如果 SerpAPI 失败或未配置，使用 DuckDuckGo
    if (!results || results.length === 0) {
      results = await searchDuckDuckGo(query, max);
    }

    // 如果仍然没有结果，返回错误
    if (!results || results.length === 0) {
      return {
        success: false,
        error: 'No search results found. Please try a different query or check your search API configuration.',
      };
    }

    return {
      success: true,
      data: {
        query,
        results,
        count: results.length,
        searchType,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

