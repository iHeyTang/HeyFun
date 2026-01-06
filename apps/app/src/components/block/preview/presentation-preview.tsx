'use client';

import { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, ChevronLeft, ChevronRight, PresentationIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PresentationPreviewProps {
  htmlUrl?: string;
  pptxUrl?: string;
  title?: string;
  className?: string;
}

export interface presentationFullscreenModalRef {
  show: (htmlUrl: string, title?: string, pptxUrl?: string) => void;
}

export interface PresentationFullscreenModalProps {
  ref?: React.RefObject<presentationFullscreenModalRef | null>;
}

// 演示文稿全屏模态组件
function PresentationFullscreenModal({ ref }: PresentationFullscreenModalProps) {
  const [htmlUrl, setHtmlUrl] = useState<string | undefined>();
  const [pptxUrl, setPptxUrl] = useState<string | undefined>();
  const [title, setTitle] = useState<string | undefined>();
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useImperativeHandle(ref, () => ({
    show: (htmlUrl: string, title?: string, pptxUrl?: string) => {
      setHtmlUrl(htmlUrl);
      setPptxUrl(pptxUrl);
      setTitle(title);
      setIsClosing(false);
      setIsOpening(true);
      setIsLoading(true);
      setHasError(false);
      setRetryCount(0);
      setCurrentSlide(0);
      setTotalSlides(0);
      setBlobUrl(null);
      // 在下一帧触发打开动画
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsOpening(false);
        });
      });
    },
  }));

  // 使用blob URL来避免下载问题
  useEffect(() => {
    if (!htmlUrl) return;

    let objectUrl: string | null = null;
    let isCancelled = false;

    const loadHtml = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        const response = await fetch(htmlUrl);
        if (!response.ok) {
          throw new Error(`Failed to load: ${response.statusText}`);
        }

        const htmlContent = await response.text();
        if (isCancelled) return;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setIsLoading(false);
      } catch (error) {
        if (isCancelled) return;
        console.error('Failed to load HTML:', error);
        setIsLoading(false);
        setHasError(true);
      }
    };

    loadHtml();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [htmlUrl, retryCount]);

  // 清理blob URL
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  useEffect(() => {
    // 设置超时：10秒后如果还在加载，显示错误
    if (isLoading && htmlUrl) {
      timeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        setHasError(true);
      }, 10000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, htmlUrl]);

  const updateSlideInIframe = (slideIndex: number) => {
    try {
      const iframe = iframeRef.current;
      if (iframe?.contentWindow?.document) {
        const slides = iframe.contentWindow.document.querySelectorAll('.slide');
        slides.forEach((slide, index) => {
          if (index === slideIndex) {
            slide.classList.add('active');
          } else {
            slide.classList.remove('active');
          }
        });
      }
    } catch (error) {
      console.error('Failed to update slide in iframe:', error);
    }
  };

  const handleNextSlide = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      if (currentSlide < totalSlides - 1) {
        const newSlide = currentSlide + 1;
        setCurrentSlide(newSlide);
        updateSlideInIframe(newSlide);
      }
    },
    [currentSlide, totalSlides],
  );

  const handlePrevSlide = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      if (currentSlide > 0) {
        const newSlide = currentSlide - 1;
        setCurrentSlide(newSlide);
        updateSlideInIframe(newSlide);
      }
    },
    [currentSlide],
  );

  const handleLoad = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsLoading(false);
    setHasError(false);

    // 获取iframe中的幻灯片数量
    try {
      const iframe = iframeRef.current;
      if (iframe?.contentWindow?.document) {
        const slides = iframe.contentWindow.document.querySelectorAll('.slide');
        setTotalSlides(slides.length);
        // 激活第一张幻灯片
        if (slides.length > 0 && slides[0]) {
          slides[0].classList.add('active');
        }
      }
    } catch (error) {
      console.error('Failed to access iframe content:', error);
    }
  };

  // 键盘导航
  useEffect(() => {
    if (!htmlUrl) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (currentSlide < totalSlides - 1) {
          const newSlide = currentSlide + 1;
          setCurrentSlide(newSlide);
          updateSlideInIframe(newSlide);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentSlide > 0) {
          const newSlide = currentSlide - 1;
          setCurrentSlide(newSlide);
          updateSlideInIframe(newSlide);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, totalSlides, htmlUrl]);

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
  };

  const handleCloseFullscreen = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setHtmlUrl(undefined);
      setBlobUrl(null);
      setIsClosing(false);
    }, 200);
  }, []);

  // 监听全局 Escape 键
  useEffect(() => {
    if (!htmlUrl) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [htmlUrl, handleCloseFullscreen]);

  if (!htmlUrl) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-2 transition-all duration-200 ease-out',
        isClosing || isOpening ? 'opacity-0 backdrop-blur-0' : 'bg-background/90 opacity-100 backdrop-blur-sm',
      )}
      onClick={handleCloseFullscreen}
    >
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center transition-all duration-200 ease-out',
          isClosing || isOpening ? 'scale-95 opacity-0' : 'scale-100 opacity-100',
        )}
        onClick={e => e.stopPropagation()}
      >
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-muted-foreground mb-2 text-sm">正在加载预览...</div>
            </div>
          </div>
        )}
        {hasError && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-destructive mb-2 text-sm">加载失败</div>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                重试
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(htmlUrl, '_blank')} className="ml-2">
                在新窗口打开
              </Button>
            </div>
          </div>
        )}
        {blobUrl && !isLoading && !hasError && (
          <iframe
            ref={iframeRef}
            key={`${htmlUrl}-${retryCount}`}
            src={blobUrl}
            className="h-auto max-h-full w-auto max-w-full rounded border-0 object-contain shadow-2xl"
            title={title || '演示文稿预览'}
            allowFullScreen
            onLoad={handleLoad}
            style={{
              width: '95vw',
              height: '95vh',
              maxWidth: '95vw',
              maxHeight: 'calc(95vh - 90px)', // 留出底部空间给翻页控制和顶部空间给关闭按钮
            }}
          />
        )}

        {/* 翻页控制 - 仅在有多张幻灯片时显示 */}
        {totalSlides > 1 && blobUrl && !isLoading && !hasError && (
          <div
            className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 transform items-center gap-2 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/95"
            onClick={e => e.stopPropagation()}
          >
            <Button variant="ghost" size="sm" onClick={handlePrevSlide} disabled={currentSlide === 0} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs text-gray-600 dark:text-gray-400">
              {currentSlide + 1} / {totalSlides}
            </span>
            <Button variant="ghost" size="sm" onClick={handleNextSlide} disabled={currentSlide === totalSlides - 1} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* 顶部控制栏 - 下载和关闭按钮 */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          {/* 下载按钮 */}
          {(pptxUrl || htmlUrl) && (
            <button
              className="bg-muted/50 text-foreground hover:bg-muted/70 flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150"
              onClick={e => {
                e.stopPropagation();
                if (pptxUrl) {
                  // 下载 PPTX
                  const link = document.createElement('a');
                  link.href = pptxUrl;
                  link.download = `${title || 'presentation'}.pptx`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                } else if (htmlUrl) {
                  // 下载 HTML
                  fetch(htmlUrl)
                    .then(response => response.blob())
                    .then(blob => {
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${title || 'presentation'}.html`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                    })
                    .catch(error => {
                      console.error('Failed to download HTML:', error);
                      // 如果下载失败，在新窗口打开
                      window.open(htmlUrl, '_blank');
                    });
                }
              }}
              title={pptxUrl ? '下载 PPTX' : '下载 HTML'}
            >
              <Download className="h-5 w-5" />
            </button>
          )}
          {/* 关闭按钮 */}
          <button
            className="bg-muted/50 text-foreground hover:bg-muted/70 flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold transition-all duration-150"
            onClick={handleCloseFullscreen}
            title="关闭"
          >
            ×
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PresentationPreview({
  htmlUrl,
  pptxUrl,
  title,
  className,
  onClick,
  onDoubleClick,
  ...props
}: PresentationPreviewProps & React.HTMLAttributes<HTMLDivElement>) {
  const presentationFullscreenModalRef = useRef<presentationFullscreenModalRef | null>(null);

  const handleClick = useCallback<NonNullable<React.DOMAttributes<HTMLDivElement>['onClick']>>(
    e => {
      // 调用用户自定义的 onClick
      if (onClick) {
        onClick(e);
      }
      // 默认行为：打开全屏
      if (htmlUrl) {
        presentationFullscreenModalRef.current?.show(htmlUrl, title, pptxUrl);
      }
    },
    [onClick, htmlUrl, title, pptxUrl],
  );

  const handleDoubleClick = useCallback<NonNullable<React.DOMAttributes<HTMLDivElement>['onDoubleClick']>>(
    e => {
      // 调用用户自定义的 onDoubleClick
      if (onDoubleClick) {
        onDoubleClick(e);
      }
      // 默认行为：打开全屏
      if (htmlUrl) {
        presentationFullscreenModalRef.current?.show(htmlUrl, title, pptxUrl);
      }
    },
    [onDoubleClick, htmlUrl, title, pptxUrl],
  );

  const handleDownloadClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (pptxUrl) {
        window.open(pptxUrl, '_blank');
      }
    },
    [pptxUrl],
  );

  if (!htmlUrl && !pptxUrl) {
    return null;
  }

  // 合并默认样式和用户自定义样式
  const defaultClassName = 'cursor-pointer';
  const finalClassName = className ? `${defaultClassName} ${className}` : defaultClassName;

  return (
    <>
      <div
        className={cn(
          'bg-muted/30 hover:border-foreground/20 group relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border transition-all hover:shadow-md',
          finalClassName,
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{ minHeight: '100px' }}
      >
        {/* 卡片内容 */}
        <div className="relative z-0 flex flex-col items-center justify-center p-6 text-center">
          <PresentationIcon className="text-muted-foreground/70 mb-3 h-8 w-8 transition-transform group-hover:scale-110" />
          <div className="text-muted-foreground mb-1 text-sm font-medium transition-colors">{title || '演示文稿'}</div>
          {pptxUrl && <div className="text-muted-foreground/70 mt-2 text-xs">点击查看预览</div>}
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
            {htmlUrl && (
              <Button
                variant="default"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  if (htmlUrl) {
                    presentationFullscreenModalRef.current?.show(htmlUrl, title);
                  }
                }}
                className="flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
                打开预览
              </Button>
            )}
            {pptxUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadClick}
                className="flex items-center gap-2 bg-white/90 text-black hover:bg-white"
              >
                <Download className="h-3 w-3" />
                下载 PPTX
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 全屏模态窗口 */}
      <PresentationFullscreenModal ref={presentationFullscreenModalRef} />
    </>
  );
}
