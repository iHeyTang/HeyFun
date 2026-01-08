'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface pdfPreviewRef {
  show: (url: string, title?: string) => void;
}

export interface PdfPreviewProps {
  pdfUrl?: string;
  title?: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
}

export interface PdfFullscreenModalProps {
  ref?: React.RefObject<pdfPreviewRef | null>;
}

// PDF 全屏模态组件
function PdfFullscreenModal({ ref }: PdfFullscreenModalProps) {
  const [url, setUrl] = useState<string | undefined>();
  const [title, setTitle] = useState<string | undefined>();
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useImperativeHandle(ref, () => ({
    show: (url: string, title?: string) => {
      setUrl(url);
      setTitle(title);
      setIsClosing(false);
      setIsOpening(true);
      setIsLoading(true);
      // 在下一帧触发打开动画
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsOpening(false);
        });
      });
    },
  }));

  const handleCloseFullscreen = useCallback(() => {
    setIsClosing(true);
    // 等待动画完成后再关闭
    setTimeout(() => {
      setUrl(undefined);
      setIsClosing(false);
      setIsLoading(true);
    }, 200);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (url) {
        window.open(url, '_blank');
      }
    },
    [url],
  );

  // 监听全局 Escape 键
  useEffect(() => {
    if (!url) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [url, handleCloseFullscreen]);

  if (!url) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex flex-col transition-all duration-200 ease-out',
        isClosing || isOpening ? 'opacity-0 backdrop-blur-0' : 'bg-black opacity-100',
      )}
      onClick={handleCloseFullscreen}
    >
      {/* 顶部控制栏 */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/20 px-4 backdrop-blur-md">
        {title && <div className="flex-1 truncate text-sm font-medium text-white">{title}</div>}
        <div className="flex items-center gap-2">
          {url && (
            <Button variant="ghost" size="sm" onClick={handleDownload} className="text-white hover:bg-white/20 hover:text-white">
              <Download className="mr-1 h-3 w-3" />
              下载
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleCloseFullscreen} className="text-white hover:bg-white/20 hover:text-white">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF 预览区域 - 全屏 */}
      <div className="relative flex-1 overflow-hidden">
        {/* 加载状态 */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
            <div className="text-muted-foreground flex flex-col items-center gap-2">
              <FileText className="h-8 w-8 animate-pulse text-white" />
              <span className="text-sm text-white">正在加载 PDF...</span>
            </div>
          </div>
        )}

        {/* PDF 预览 */}
        {url && (
          <iframe
            ref={iframeRef}
            src={`${url}#toolbar=1&navpanes=1&scrollbar=1`}
            className="h-full w-full border-0"
            title={title || 'PDF 预览'}
            onLoad={handleLoad}
            onClick={e => e.stopPropagation()}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

export function PdfPreview({ pdfUrl, title, className, onClick, onDoubleClick, ...props }: PdfPreviewProps & React.HTMLAttributes<HTMLDivElement>) {
  const pdfFullscreenModalRef = useRef<pdfPreviewRef | null>(null);

  const handleClick = useCallback<NonNullable<React.DOMAttributes<HTMLDivElement>['onClick']>>(
    e => {
      // 调用用户自定义的 onClick
      if (onClick) {
        onClick(e);
      }
      // 默认行为：打开全屏
      if (pdfUrl) {
        pdfFullscreenModalRef.current?.show(pdfUrl, title);
      }
    },
    [onClick, pdfUrl, title],
  );

  const handleDoubleClick = useCallback<NonNullable<React.DOMAttributes<HTMLDivElement>['onDoubleClick']>>(
    e => {
      // 调用用户自定义的 onDoubleClick
      if (onDoubleClick) {
        onDoubleClick(e);
      }
      // 默认行为：打开全屏
      if (pdfUrl) {
        pdfFullscreenModalRef.current?.show(pdfUrl, title);
      }
    },
    [onDoubleClick, pdfUrl, title],
  );

  const handleDownloadClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (pdfUrl) {
        window.open(pdfUrl, '_blank');
      }
    },
    [pdfUrl],
  );

  if (!pdfUrl) {
    return null;
  }

  // 合并默认样式和用户自定义样式
  const defaultClassName = 'cursor-pointer';
  const finalClassName = className ? `${defaultClassName} ${className}` : defaultClassName;

  return (
    <>
      <div
        {...props}
        className={cn(
          'group relative overflow-hidden rounded-lg border border-gray-200/50 bg-gray-50/50 dark:border-gray-800/50 dark:bg-gray-900/50',
          finalClassName,
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* PDF 缩略图预览 */}
        <div className="flex h-48 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400">
            <FileText className="h-12 w-12" />
            <span className="text-xs font-medium">{title || 'PDF 文件'}</span>
            <span className="text-[10px] opacity-70">点击查看预览</span>
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
            {pdfUrl && (
              <Button
                variant="default"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  if (pdfUrl) {
                    pdfFullscreenModalRef.current?.show(pdfUrl, title);
                  }
                }}
                className="flex items-center gap-2"
              >
                <FileText className="h-3 w-3" />
                打开预览
              </Button>
            )}
            {pdfUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadClick}
                className="flex items-center gap-2 bg-white/90 text-black hover:bg-white"
              >
                <Download className="h-3 w-3" />
                下载 PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 全屏模态窗口 */}
      <PdfFullscreenModal ref={pdfFullscreenModalRef} />
    </>
  );
}
