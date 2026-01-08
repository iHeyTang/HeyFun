/**
 * Douyin Download Video 工具结果展示组件
 */

'use client';

import { Download, ExternalLink, FileText, Loader2, Video, User, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DouyinDownloadVideoResultProps {
  args?: Record<string, any>;
  result?: any;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  sessionId?: string;
}

interface DownloadData {
  videoId?: string;
  title?: string;
  author?: {
    name?: string;
    id?: string;
  };
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  assetId?: string;
  assetUrl?: string;
  videoUrl?: string;
  coverUrl?: string;
}

// 格式化文件大小
function formatFileSize(bytes?: number): string {
  if (!bytes) return '未知大小';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function DouyinDownloadVideoResult({ args, result, status, error }: DouyinDownloadVideoResultProps) {
  const url = args?.url;
  const data: DownloadData | null = result && status === 'success' ? result : null;

  // 错误状态
  if (status === 'error' || error) {
    return (
      <div className="space-y-1">
        {url && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Video className="h-3 w-3" />
            <span>
              视频链接: <span className="text-foreground/80 break-all font-mono text-xs">{url}</span>
            </span>
          </div>
        )}
        <div className="text-xs text-red-600 dark:text-red-400">{error || '下载失败'}</div>
      </div>
    );
  }

  // 加载中或等待状态
  if (status === 'pending' || status === 'running') {
    return (
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>
          正在下载视频: <span className="text-foreground/80 break-all font-medium">{url || '...'}</span>
        </span>
      </div>
    );
  }

  // 成功状态但没有下载 URL
  if (!data?.downloadUrl) {
    return (
      <div className="space-y-2">
        {url && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Video className="h-3 w-3" />
            <span>
              视频链接: <span className="text-foreground/80 break-all font-mono text-xs">{url}</span>
            </span>
          </div>
        )}
        <div className="text-muted-foreground/70 text-xs">下载完成，但未获取到文件 URL</div>
      </div>
    );
  }

  // 成功状态 - 显示下载结果
  return (
    <div className="space-y-3">
      {/* 视频信息 */}
      <div className="space-y-2">
        {data.title && (
          <div>
            <h4 className="text-sm font-medium text-foreground">{data.title}</h4>
          </div>
        )}
        {data.author && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <User className="h-3 w-3" />
            <span>{data.author.name || '未知作者'}</span>
          </div>
        )}
      </div>

      {/* 文件信息 */}
      <div className="space-y-1 border-t border-gray-200/50 pt-2 dark:border-gray-800/50">
        <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
          <FileText className="h-3 w-3" />
          <span>
            文件名: <span className="text-foreground/80 font-medium">{data.fileName || 'video.mp4'}</span>
            {data.fileSize && <span className="text-muted-foreground/50 ml-1">({formatFileSize(data.fileSize)})</span>}
          </span>
        </div>
        {data.assetId && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
            <span>
              已保存到资源库: <span className="text-foreground/80 font-mono text-xs">{data.assetId}</span>
            </span>
          </div>
        )}
      </div>

      {/* 视频预览和下载 */}
      <div className="space-y-2">
        {data.coverUrl && (
          <div className="relative overflow-hidden rounded-lg border border-gray-200/50 dark:border-gray-800/50">
            <img
              src={data.coverUrl}
              alt={data.title || '视频封面'}
              className="h-48 w-full object-cover"
              onError={e => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="border-border/30 bg-muted/20 rounded border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground/70" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{data.fileName || 'video.mp4'}</div>
                {data.fileSize && <div className="text-muted-foreground text-xs">{formatFileSize(data.fileSize)}</div>}
              </div>
            </div>
            <a
              href={data.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-muted/40 flex items-center gap-2 rounded px-3 py-1.5 transition-colors"
            >
              <Download className="h-4 w-4 text-muted-foreground/70" />
              <span className="text-sm">下载</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground/70" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
