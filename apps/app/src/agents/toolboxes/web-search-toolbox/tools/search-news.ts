import { ToolResult } from '@/agents/core/tools/tool-definition';
import { WebSearchToolboxContext } from '../context';

/**
 * 使用 DuckDuckGo HTML 搜索并解析结果
 * 这是一个更可靠的方法，可以获取实际的搜索结果
 */
async function searchNewsDuckDuckGo(query: string, maxResults: number = 10, language: string = 'zh-CN'): Promise<any> {
  try {
    // 构建搜索 URL，添加新闻相关关键词
    const newsQuery = `${query} news`;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(newsQuery)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': language,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const results: any[] = [];

    // 简单的 HTML 解析：查找搜索结果
    // DuckDuckGo 的搜索结果通常在 <div class="result"> 或类似的标签中
    // 使用正则表达式提取标题、链接和摘要

    // 匹配结果项的正则表达式（DuckDuckGo HTML 结构）
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
      const snippet = match[1]?.trim();
      if (snippet) {
        snippets.push(snippet);
      }
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
          type: 'news',
        });
      }
    }

    // 如果 HTML 解析没有结果，尝试使用 Instant Answer API 作为备用
    if (results.length === 0) {
      const instantAnswerUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(newsQuery)}&format=json&no_html=1&skip_disambig=1`;
      const iaResponse = await fetch(instantAnswerUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (iaResponse.ok) {
        const data = await iaResponse.json();

        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
          for (const topic of data.RelatedTopics.slice(0, maxResults)) {
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.substring(0, 100),
                snippet: topic.Text,
                url: topic.FirstURL,
                source: 'DuckDuckGo',
                type: 'news',
              });
            }
          }
        }

        if (data.AbstractText && results.length === 0) {
          results.push({
            title: data.Heading || data.AbstractText.substring(0, 50),
            snippet: data.AbstractText,
            url: data.AbstractURL,
            source: 'DuckDuckGo',
            type: 'news',
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('[WebSearch] News search error:', error);
    throw error;
  }
}

/**
 * 使用 SerpAPI 搜索新闻（如果配置了 API key）
 */
async function searchNewsSerpAPI(query: string, maxResults: number = 10, apiKey?: string): Promise<any> {
  if (!apiKey) {
    return null;
  }

  try {
    const url = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${maxResults}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`SerpAPI error! status: ${response.status}`);
    }

    const data = await response.json();
    const results: any[] = [];

    if (data.news_results && Array.isArray(data.news_results)) {
      for (const result of data.news_results.slice(0, maxResults)) {
        results.push({
          title: result.title,
          snippet: result.snippet,
          url: result.link,
          source: result.source || 'Unknown',
          date: result.date,
          type: 'news',
        });
      }
    }

    return results;
  } catch (error) {
    console.error('[WebSearch] SerpAPI news search error:', error);
    return null;
  }
}

const executor = async (args: any, context: WebSearchToolboxContext): Promise<ToolResult> => {
  try {
    const { query, maxResults = 10, language = 'zh-CN' } = args;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return {
        success: false,
        error: 'Search query is required and must be a non-empty string',
      };
    }

    const max = Math.min(Math.max(1, parseInt(String(maxResults)) || 10), 50);

    // 优先尝试 SerpAPI（如果配置了）
    const serpApiKey = process.env.SERPAPI_API_KEY;
    let results = await searchNewsSerpAPI(query, max, serpApiKey);

    // 如果 SerpAPI 失败或未配置，使用 DuckDuckGo
    if (!results || results.length === 0) {
      results = await searchNewsDuckDuckGo(query, max, language);
    }

    if (!results || results.length === 0) {
      return {
        success: false,
        error: 'No news results found. Please try a different query or check your search API configuration.',
      };
    }

    return {
      success: true,
      data: {
        query,
        results,
        count: results.length,
        type: 'news',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

export const searchNewsTool = {
  toolName: 'search_news',
  executor,
};
