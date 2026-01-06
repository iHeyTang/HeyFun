/**
 * Web Search 工具完整展示组件（包含参数和结果）
 */

'use client';

import { ExternalLink, Search } from 'lucide-react';

interface WebSearchResultProps {
  args?: Record<string, any>;
  result?: any; // result.data 的结构: { query: string, results: Array, count: number, searchType: string }
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

interface WebSearchData {
  query?: string;
  count?: number;
  results?: Array<{
    title?: string;
    url?: string;
    snippet?: string;
    source?: string;
  }>;
  searchType?: string;
}

export function WebSearchResult({ args, result, status, error }: WebSearchResultProps) {
  // 解析 DuckDuckGo 重定向链接，提取真实 URL（双重保险，后端应该已经解析过了）
  const extractRealUrl = (url: string): string => {
    try {
      // 如果是 DuckDuckGo 的重定向链接
      if (url.includes('duckduckgo.com/l/?') || url.includes('duckduckgo.com/l?')) {
        // 处理 HTML 实体编码（如 &amp;）
        let decodedUrl = url.replace(/&amp;/g, '&');

        // 处理协议相对 URL（以 // 开头）
        if (decodedUrl.startsWith('//')) {
          decodedUrl = 'https:' + decodedUrl;
        }

        // 解析 URL 并提取真实链接
        const urlObj = new URL(decodedUrl);
        const uddg = urlObj.searchParams.get('uddg');
        if (uddg) {
          return decodeURIComponent(uddg);
        }
      }
      return url;
    } catch (error) {
      console.warn('Failed to extract real URL from DuckDuckGo redirect:', error);
      return url;
    }
  };

  // 处理外部链接打开
  const handleOpenExternal = (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const realUrl = extractRealUrl(url);
    window.open(realUrl, '_blank');
  };

  // 解析结果数据 - result 就是 result.data，结构为 { query, results, count, searchType }
  const data: WebSearchData | null = result && status === 'success' ? result : null;

  // 从参数或结果中获取查询关键词
  const query = args?.query || data?.query;

  // 错误状态
  if (status === 'error' || error) {
    return (
      <div className="space-y-1">
        {query && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Search className="h-3 w-3" />
            <span>
              搜索关键词: <span className="text-foreground/80 font-medium">{query}</span>
            </span>
          </div>
        )}
        <div className="text-xs text-red-600 dark:text-red-400">{error || '搜索失败'}</div>
      </div>
    );
  }

  // 加载中或等待状态
  if (status === 'pending' || status === 'running') {
    return (
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
        <Search className="h-3 w-3 animate-pulse" />
        <span>
          正在搜索: <span className="text-foreground/80 font-medium">{query || '...'}</span>
        </span>
      </div>
    );
  }

  // 成功状态但没有结果
  if (!data || !data.results || data.results.length === 0) {
    return (
      <div className="space-y-1">
        {query && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Search className="h-3 w-3" />
            <span>
              搜索关键词: <span className="text-foreground/80 font-medium">{query}</span>
            </span>
          </div>
        )}
        <div className="text-muted-foreground/70 text-xs">未找到搜索结果</div>
      </div>
    );
  }

  // 成功状态，有结果
  return (
    <div className="space-y-2">
      {/* 搜索关键词和结果数量 */}
      <div className="text-muted-foreground/70 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="flex items-center gap-1.5">
          <span>
            搜索关键词: <span className="text-foreground/80 font-medium">{query}</span>
          </span>
          {data.count !== undefined && <span className="text-muted-foreground/50">({data.count} 条结果)</span>}
        </span>
      </div>

      <div className="space-y-2">
        {data.results.map((item, index) => {
          const realUrl = item.url ? extractRealUrl(item.url) : undefined;
          return (
            <div key={index} className="border-border/30 bg-muted/20 hover:bg-muted/30 rounded border p-2 transition-colors">
              {item.title && (
                <div className="mb-1 flex items-start gap-1.5">
                  {realUrl ? (
                    <button
                      type="button"
                      onClick={e => handleOpenExternal(item.url!, e)}
                      className="text-foreground/90 line-clamp-2 flex-1 cursor-pointer text-left text-xs font-medium hover:underline"
                    >
                      {item.title}
                    </button>
                  ) : (
                    <h4 className="text-foreground/90 line-clamp-2 flex-1 text-xs font-medium">{item.title}</h4>
                  )}
                  {realUrl && (
                    <button
                      type="button"
                      onClick={e => handleOpenExternal(item.url!, e)}
                      className="text-muted-foreground/50 hover:text-foreground/70 flex-shrink-0 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              {realUrl && !item.title && (
                <button
                  type="button"
                  onClick={e => handleOpenExternal(item.url!, e)}
                  className="mb-1 flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {realUrl}
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}

              {item.snippet && <p className="text-muted-foreground/70 line-clamp-3 text-xs leading-relaxed">{item.snippet}</p>}

              {item.source && <div className="text-muted-foreground/50 mt-1 text-xs">来源: {item.source}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
