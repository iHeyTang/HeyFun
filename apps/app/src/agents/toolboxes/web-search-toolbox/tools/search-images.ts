import { ToolResult } from '@/agents/core/tools/tool-definition';
import { WebSearchToolboxContext } from '../context';

/**
 * 使用 SerpAPI 搜索图片（如果配置了 API key）
 */
async function searchImagesSerpAPI(query: string, maxResults: number = 10, apiKey?: string): Promise<any> {
  if (!apiKey) {
    return null;
  }

  try {
    const url = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${maxResults}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`SerpAPI error! status: ${response.status}`);
    }

    const data = await response.json();
    const results: any[] = [];

    if (data.images_results && Array.isArray(data.images_results)) {
      for (const result of data.images_results.slice(0, maxResults)) {
        results.push({
          title: result.title,
          thumbnail: result.thumbnail,
          image: result.original || result.thumbnail,
          url: result.link,
          source: result.source || 'Unknown',
          width: result.original_width,
          height: result.original_height,
          type: 'image',
        });
      }
    }

    return results;
  } catch (error) {
    console.error('[WebSearch] SerpAPI image search error:', error);
    return null;
  }
}

/**
 * 使用 DuckDuckGo 搜索图片
 * 注意：DuckDuckGo 的 Instant Answer API 不支持图片搜索
 * 这里提供一个基础实现，实际使用时建议配置 SerpAPI
 */
async function searchImagesDuckDuckGo(query: string, maxResults: number = 10): Promise<any> {
  // DuckDuckGo 的图片搜索需要通过 HTML 解析，比较复杂
  // 这里返回空结果，提示用户使用 SerpAPI
  return [];
}

const executor = async (args: any, context: WebSearchToolboxContext): Promise<ToolResult> => {
  try {
    const { query, maxResults = 10, imageType = 'all', size = 'all' } = args;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return {
        success: false,
        error: 'Search query is required and must be a non-empty string',
      };
    }

    const max = Math.min(Math.max(1, parseInt(String(maxResults)) || 10), 50);

    // 优先尝试 SerpAPI（如果配置了）
    const serpApiKey = process.env.SERPAPI_API_KEY;
    let results = await searchImagesSerpAPI(query, max, serpApiKey);

    // 如果 SerpAPI 失败或未配置，尝试 DuckDuckGo
    if (!results || results.length === 0) {
      results = await searchImagesDuckDuckGo(query, max);
    }

    if (!results || results.length === 0) {
      return {
        success: false,
        error: 'No image results found. Please configure SERPAPI_API_KEY environment variable for image search, or try a different query.',
      };
    }

    return {
      success: true,
      data: {
        query,
        results,
        count: results.length,
        type: 'images',
        filters: {
          imageType,
          size,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

export const searchImagesTool = {
  toolName: 'search_images',
  executor,
};
