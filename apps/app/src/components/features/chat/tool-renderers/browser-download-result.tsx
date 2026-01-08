/**
 * Browser Download 工具结果展示组件
 */

'use client';

import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BrowserDownloadResultProps {
  args?: Record<string, any>;
  result?: any; // result.data 的结构: { downloadUrl: string, fileName: string, fileSize: number, url: string, assetId?: string, assetUrl?: string }
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  sessionId?: string;
}

interface BrowserDownloadData {
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  url?: string;
  assetId?: string;
  assetUrl?: string;
}

// 判断文件是否为 PDF
function isPdfFile(fileName?: string, url?: string): boolean {
  if (!fileName && !url) return false;
  const name = fileName || url || '';
  return name.toLowerCase().endsWith('.pdf') || name.toLowerCase().includes('application/pdf');
}

// 格式化文件大小
function formatFileSize(bytes?: number): string {
  if (!bytes) return '未知大小';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// PDF 下载卡片组件
function PdfDownloadCard({ pdfUrl, title, className }: { pdfUrl: string; title?: string; className?: string }) {
  const handleDownload = () => {
    window.open(pdfUrl, '_blank');
  };

  return (
    <div
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-lg border border-gray-200/50 bg-gray-50/50 dark:border-gray-800/50 dark:bg-gray-900/50',
        className,
      )}
      onClick={handleDownload}
    >
      {/* PDF 缩略图预览 */}
      <div className="flex h-48 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400">
          <FileText className="h-12 w-12" />
          <span className="text-xs font-medium">{title || 'PDF 文件'}</span>
          <span className="text-[10px] opacity-70">点击下载</span>
        </div>
      </div>

      {/* 悬停遮罩 */}
      <div
        className={cn(
          'absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/60 transition-opacity',
          'opacity-0 group-hover:opacity-100',
        )}
        style={{ pointerEvents: 'none' }}
      >
        <div className="flex flex-col gap-2" style={{ pointerEvents: 'auto' }}>
          <Button variant="default" size="sm" onClick={handleDownload} className="flex items-center gap-2">
            <Download className="h-3 w-3" />
            下载 PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

export function BrowserDownloadResult({ args, result, status, error, sessionId }: BrowserDownloadResultProps) {
  // 解析结果数据
  const data: BrowserDownloadData | null = result && status === 'success' ? result : null;
  const url = args?.url || data?.url;
  const downloadUrl = data?.downloadUrl || data?.assetUrl;
  const fileName = data?.fileName || '下载的文件';
  const fileSize = data?.fileSize;
  const isPdf = isPdfFile(fileName, downloadUrl);

  // 错误状态
  if (status === 'error' || error) {
    return (
      <div className="space-y-1">
        {url && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Download className="h-3 w-3" />
            <span>
              下载 URL: <span className="text-foreground/80 break-all font-mono text-xs">{url}</span>
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
          正在下载: <span className="text-foreground/80 break-all font-medium">{url || '...'}</span>
        </span>
      </div>
    );
  }

  // 成功状态但没有下载 URL
  if (!downloadUrl) {
    return (
      <div className="space-y-2">
        {url && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Download className="h-3 w-3" />
            <span>
              下载 URL: <span className="text-foreground/80 break-all font-mono text-xs">{url}</span>
            </span>
          </div>
        )}
        <div className="text-muted-foreground/70 text-xs">下载完成，但未获取到文件 URL</div>
      </div>
    );
  }

  // 成功状态 - 显示文件信息
  return (
    <div className="space-y-2">
      {/* 文件信息 */}
      <div className="space-y-1">
        <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
          <Download className="h-3 w-3" />
          <span>
            下载 URL: <span className="text-foreground/80 break-all font-mono text-xs">{url}</span>
          </span>
        </div>
        <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
          <FileText className="h-3 w-3" />
          <span>
            文件名: <span className="text-foreground/80 font-medium">{fileName}</span>
            {fileSize && <span className="text-muted-foreground/50 ml-1">({formatFileSize(fileSize)})</span>}
          </span>
        </div>
        {data?.assetId && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <span>
              已保存到资源库: <span className="text-foreground/80 font-mono text-xs">{data.assetId}</span>
            </span>
          </div>
        )}
      </div>

      {/* PDF 卡片或下载链接 */}
      {isPdf && downloadUrl ? (
        <div className="space-y-1">
          <PdfDownloadCard pdfUrl={downloadUrl} title={fileName} className="w-full" />
        </div>
      ) : (
        <div className="border-border/30 bg-muted/20 rounded border p-2">
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-muted/40 flex items-center gap-2 rounded p-2 transition-colors"
          >
            <FileText className="h-4 w-4 text-muted-foreground/70" />
            <div className="flex-1">
              <div className="text-sm font-medium">{fileName}</div>
              {fileSize && <div className="text-muted-foreground text-xs">{formatFileSize(fileSize)}</div>}
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground/70" />
          </a>
        </div>
      )}
    </div>
  );
}
