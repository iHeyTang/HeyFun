/**
 * Browser Navigate 工具结果展示组件
 */

'use client';

import { ExternalLink, Globe, Loader2 } from 'lucide-react';
import { ImagePreview } from '@/components/block/preview/image-preview';

interface BrowserNavigateResultProps {
  args?: Record<string, any>;
  result?: any; // result.data 的结构: { url: string, title?: string, screenshot?: string }
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  sessionId?: string;
}

interface BrowserNavigateData {
  url?: string;
  title?: string;
  screenshot?: string;
}

export function BrowserNavigateResult({ args, result, status, error, sessionId }: BrowserNavigateResultProps) {
  // 解析结果数据
  const data: BrowserNavigateData | null = result && status === 'success' ? result : null;
  const url = args?.url || data?.url;

  // 错误状态
  if (status === 'error' || error) {
    return (
      <div className="space-y-1">
        {url && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Globe className="h-3 w-3" />
            <span>
              访问 URL: <span className="text-foreground/80 break-all font-medium">{url}</span>
            </span>
          </div>
        )}
        <div className="text-xs text-red-600 dark:text-red-400">{error || '导航失败'}</div>
      </div>
    );
  }

  // 加载中或等待状态
  if (status === 'pending' || status === 'running') {
    return (
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>
          正在导航到: <span className="text-foreground/80 break-all font-medium">{url || '...'}</span>
        </span>
      </div>
    );
  }

  // 成功状态
  return (
    <div className="space-y-2">
      {/* URL 和标题信息 */}
      <div className="space-y-1">
        {url && (
          <div className="text-muted-foreground/70 flex items-start gap-1.5 text-xs">
            <Globe className="mt-0.5 h-3 w-3 flex-shrink-0" />
            {data?.title && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/70 text-xs hover:underline">
                <span className="text-foreground/80 font-medium">{data.title}</span>
                <ExternalLink className="ml-1 inline h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* 截图预览（如果有） */}
      {data?.screenshot && (
        <div className="space-y-1">
          <div className="border-border/30 overflow-hidden rounded border">
            <ImagePreview src={data.screenshot} alt="Page screenshot" className="h-auto w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
