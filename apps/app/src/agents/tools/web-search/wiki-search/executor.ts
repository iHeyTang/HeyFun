import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { wikiSearchParamsSchema } from './schema';

interface WikiResult {
  title: string;
  extract: string;
  url: string;
  pageId: number;
  thumbnail?: string;
  language: string;
}

/**
 * 使用 Wikipedia API 搜索百科内容
 */
async function searchWikipedia(query: string, maxResults: number = 5, language: string = 'zh'): Promise<WikiResult[]> {
  try {
    // Wikipedia API 端点
    const apiUrl = `https://${language}.wikipedia.org/w/api.php`;

    // 第一步：搜索页面
    const searchParams = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: maxResults.toString(),
      format: 'json',
      origin: '*',
    });

    const searchResponse = await fetch(`${apiUrl}?${searchParams.toString()}`);
    if (!searchResponse.ok) {
      throw new Error(`Wikipedia API error! status: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const pageIds: number[] = [];

    if (searchData.query?.search && Array.isArray(searchData.query.search)) {
      for (const item of searchData.query.search) {
        if (item.pageid) {
          pageIds.push(item.pageid);
        }
      }
    }

    if (pageIds.length === 0) {
      return [];
    }

    // 第二步：获取页面内容和摘要
    const contentParams = new URLSearchParams({
      action: 'query',
      prop: 'extracts|info|pageimages',
      pageids: pageIds.join('|'),
      exintro: 'true',
      explaintext: 'true',
      exchars: '500', // 限制摘要长度
      piprop: 'thumbnail',
      pithumbsize: '200',
      inprop: 'url',
      format: 'json',
      origin: '*',
    });

    const contentResponse = await fetch(`${apiUrl}?${contentParams.toString()}`);
    if (!contentResponse.ok) {
      throw new Error(`Wikipedia API error! status: ${contentResponse.status}`);
    }

    const contentData = await contentResponse.json();
    const results: WikiResult[] = [];

    if (contentData.query?.pages) {
      for (const pageId in contentData.query.pages) {
        const page = contentData.query.pages[pageId];
        if (page && !page.missing) {
          results.push({
            title: page.title || '',
            extract: page.extract || '',
            url: page.fullurl || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(page.title || '')}`,
            pageId: page.pageid || parseInt(pageId),
            thumbnail: page.thumbnail?.source,
            language,
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('[WikiSearch] Wikipedia search error:', error);
    throw error;
  }
}

/**
 * 尝试多个语言版本的 Wikipedia
 */
async function searchWikipediaMultiLanguage(query: string, maxResults: number = 5, preferredLanguage: string = 'zh'): Promise<WikiResult[]> {
  // 语言优先级列表
  const languages = [preferredLanguage, 'en', 'zh', 'ja', 'ko'].filter(
    (lang, index, self) => self.indexOf(lang) === index, // 去重
  );

  for (const lang of languages) {
    try {
      const results = await searchWikipedia(query, maxResults, lang);
      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      console.warn(`[WikiSearch] Failed to search in ${lang} Wikipedia:`, error);
      // 继续尝试下一个语言
    }
  }

  return [];
}

export const wikiSearchExecutor = definitionToolExecutor(wikiSearchParamsSchema, async (args, context) => {
  try {
    const { query, maxResults = 5, language = 'zh' } = args;

    // 使用 Wikipedia API 搜索
    let results = await searchWikipedia(query, maxResults, language);

    // 如果首选语言没有结果，尝试其他语言
    if (results.length === 0 && language !== 'en') {
      results = await searchWikipediaMultiLanguage(query, maxResults, language);
    }

    if (!results || results.length === 0) {
      return {
        success: false,
        error: 'No wiki results found. Please try a different query or check if the topic exists in Wikipedia.',
      };
    }

    return {
      success: true,
      data: {
        query,
        results,
        count: results.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
});
