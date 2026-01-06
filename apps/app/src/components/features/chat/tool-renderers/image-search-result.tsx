/**
 * Image Search 工具完整展示组件（包含参数和结果）
 */

'use client';

import { ExternalLink, Image as ImageIcon, Loader2 } from 'lucide-react';
import { ImagePreview } from '@/components/block/preview/image-preview';
import { useRef } from 'react';
import { FullscreenModal, fullscreenModalRef } from '@/components/block/preview/fullscreen';

interface ImageSearchResultProps {
  args?: Record<string, any>;
  result?: any; // result.data 的结构: { query: string, results: ImageResult[], count: number, type: 'images' }
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

interface ImageResult {
  title?: string;
  thumbnail?: string;
  image?: string;
  url?: string;
  source?: string;
  width?: number;
  height?: number;
  type?: 'image';
  author?: string;
  authorUrl?: string;
}

interface ImageSearchData {
  query?: string;
  count?: number;
  results?: ImageResult[];
  type?: 'images';
}

export function ImageSearchResult({ args, result, status, error }: ImageSearchResultProps) {
  // 解析结果数据 - result 就是 result.data，结构为 { query, results, count, type }
  const data: ImageSearchData | null = result && status === 'success' ? result : null;

  // 从参数或结果中获取查询关键词
  const query = args?.query || data?.query;

  // 全屏预览模态框引用
  const imageModalRef = useRef<fullscreenModalRef | null>(null);

  // 处理图片预览点击
  const handleImagePreview = (imageUrl: string) => {
    if (imageModalRef.current) {
      imageModalRef.current.show(imageUrl, 'image');
    }
  };

  // 处理外部链接打开
  const handleOpenExternal = (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (url) {
      window.open(url, '_blank');
    }
  };

  // 错误状态
  if (status === 'error' || error) {
    return (
      <div className="space-y-1">
        {query && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <ImageIcon className="h-3 w-3" />
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
        <ImageIcon className="h-3 w-3 animate-pulse" />
        <span>
          正在搜索图片: <span className="text-foreground/80 font-medium">{query || '...'}</span>
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
            <ImageIcon className="h-3 w-3" />
            <span>
              搜索关键词: <span className="text-foreground/80 font-medium">{query}</span>
            </span>
          </div>
        )}
        <div className="text-muted-foreground/70 text-xs">未找到图片结果</div>
      </div>
    );
  }

  // 成功状态，有结果
  return (
    <div className="space-y-2">
      {/* 搜索关键词和结果数量 */}
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
        <ImageIcon className="h-3 w-3" />
        <span>
          搜索关键词: <span className="text-foreground/80 font-medium">{query}</span>
        </span>
        {data.count !== undefined && <span className="text-muted-foreground/50">({data.count} 张图片)</span>}
      </div>

      {/* 图片网格 */}
      <div className="grid gap-3">
        {data.results.map((item, index) => {
          const imageUrl = item.image || item.thumbnail;
          if (!imageUrl) return null;

          return (
            <div key={index} className="relative h-48 w-48 overflow-hidden rounded-lg">
              {/* 图片预览 - 方形显示，确保有足够高度 */}
              <ImagePreview
                src={imageUrl}
                alt={item.title || `图片 ${index + 1}`}
                className="h-48 w-48 object-cover transition-transform duration-300 hover:scale-110"
                loading="lazy"
              />

              {/* 图片信息遮罩 - 可点击，优化布局，确保在小尺寸下也能正常显示 */}
              <div
                className="absolute inset-x-0 bottom-0 cursor-pointer bg-gradient-to-t from-black/80 via-black/50 to-transparent p-2.5"
                onClick={() => handleImagePreview(imageUrl)}
              >
                {item.title && <p className="mb-1 line-clamp-2 text-[11px] font-medium leading-tight text-white/95">{item.title}</p>}
                <div className="flex items-center justify-between gap-1.5">
                  {item.source && <span className="flex-1 truncate text-[10px] text-white/85">{item.source}</span>}
                  {item.url && (
                    <button
                      type="button"
                      onClick={e => handleOpenExternal(item.url!, e)}
                      className="flex-shrink-0 cursor-pointer rounded-md bg-black/40 p-1.5 text-white/90 transition-all duration-200 hover:scale-110 hover:bg-black/70 hover:text-white hover:shadow-md active:scale-95"
                      title="查看原图"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* 图片尺寸信息（如果有） */}
              {item.width && item.height && (
                <div className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                  <span className="text-[9px] font-medium text-white/90">
                    {item.width} × {item.height}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 全屏预览模态框 */}
      <FullscreenModal ref={imageModalRef} />
    </div>
  );
}
