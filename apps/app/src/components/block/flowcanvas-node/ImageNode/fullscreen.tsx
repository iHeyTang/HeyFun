import { useCallback, useEffect, useImperativeHandle, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown, Star, Keyboard } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslations } from 'next-intl';

export interface fullscreenModalRef {
  show: (data: { coverKey?: string; images?: string[] }) => void;
}

export interface FullscreenModalProps {
  ref?: React.RefObject<fullscreenModalRef | null>;
  onSetCover?: (key: string) => void;
}

// 全屏模态窗口组件
export function FullscreenModal({ ref, onSetCover }: FullscreenModalProps) {
  const t = useTranslations('flowcanvas.nodes');

  const [coverKey, setCoverKey] = useState<string | undefined>();
  const [images, setImages] = useState<string[] | undefined>();
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  // 滚动缩略图到当前选中的位置
  const scrollToCurrentThumbnail = useCallback(() => {
    if (thumbnailContainerRef.current && images && images.length > 0) {
      const container = thumbnailContainerRef.current;
      const thumbnailHeight = 64 + 8; // 64px (h-16) + 8px (gap-2)
      const scrollTop = currentIndex * thumbnailHeight;

      container.scrollTo({
        top: scrollTop,
        behavior: 'smooth',
      });
    }
  }, [currentIndex, images]);

  useImperativeHandle(ref, () => ({
    show: (data: { coverKey?: string; images?: string[] }) => {
      setCoverKey(data.coverKey);
      setImages(data.images);
      setIsClosing(false);
      setIsOpening(true);
      // 找到 coverKey 对应的索引
      if (data.coverKey && data.images) {
        const index = data.images.indexOf(data.coverKey);
        setCurrentIndex(index >= 0 ? index : 0);
      } else {
        setCurrentIndex(0);
      }
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
      setCoverKey(undefined);
      setImages(undefined);
      setIsClosing(false);
      setCurrentIndex(0);
    }, 200); // 与动画时间保持一致
  }, []);

  const handlePrevious = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (images && images.length > 0) {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
      }
    },
    [images],
  );

  const handleNext = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (images && images.length > 0) {
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
      }
    },
    [images],
  );

  const handleSetCover = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (images && images.length > 0 && onSetCover && images[currentIndex]) {
        const newCoverKey = images[currentIndex];
        // 立即更新本地状态，使UI立刻响应
        setCoverKey(newCoverKey);
        // 调用父组件回调
        onSetCover(newCoverKey);
      }
    },
    [images, currentIndex, onSetCover],
  );

  // 监听 currentIndex 变化，自动滚动缩略图
  useEffect(() => {
    scrollToCurrentThumbnail();
  }, [scrollToCurrentThumbnail]);

  // 监听全局 Escape 和箭头键（支持左利手控制：w=上，s=下）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseFullscreen();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        // 上一张：方向键上 或 w/W 键（左利手）
        if (images && images.length > 0) {
          setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
        }
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        // 下一张：方向键下 或 s/S 键（左利手）
        if (images && images.length > 0) {
          setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
        }
      } else if (e.key === 'c' || e.key === 'C') {
        // 设置封面：c/C 键
        if (images && images.length > 0 && onSetCover && images[currentIndex]) {
          const newCoverKey = images[currentIndex];
          setCoverKey(newCoverKey);
          onSetCover(newCoverKey);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleCloseFullscreen, images, currentIndex, onSetCover]);

  if (!images || images.length === 0) {
    return null;
  }

  const currentImageKey = images[currentIndex];
  const hasMultipleImages = images.length > 1;
  const isCurrentImageCover = coverKey && currentImageKey && currentImageKey === coverKey;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ease-out ${
        isClosing || isOpening ? 'backdrop-blur-0 opacity-0' : 'bg-background/90 opacity-100 backdrop-blur-sm'
      }`}
      onClick={handleCloseFullscreen}
    >
      <div
        className={`relative flex h-full w-full items-center justify-center transition-all duration-200 ease-out ${
          isClosing || isOpening ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* 左侧缩略图导航 */}
        {hasMultipleImages && (
          <div
            ref={thumbnailContainerRef}
            className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted/50 hover:scrollbar-thumb-muted/70 absolute top-1/2 left-4 z-10 max-h-[calc(100vh-100px)] -translate-y-1/2 overflow-y-auto pr-2"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2 p-3">
              {images.map((imageKey, idx) => {
                const isCover = coverKey && imageKey === coverKey;
                return (
                  <button
                    key={imageKey}
                    className={`relative h-32 w-32 flex-shrink-0 overflow-hidden rounded border-2 transition-all duration-150 ${
                      idx === currentIndex ? 'border-primary scale-110' : 'border-muted/50 hover:border-muted/70'
                    }`}
                    onClick={e => {
                      e.stopPropagation();
                      setCurrentIndex(idx);
                    }}
                  >
                    <img src={`/api/oss/${imageKey}`} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                    {/* 封面徽标 */}
                    {isCover && (
                      <div className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 shadow-lg">
                        <Star className="h-4 w-4 fill-white text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 主图片 */}
        <img
          src={currentImageKey ? `/api/oss/${currentImageKey}` : undefined}
          className="h-auto max-h-full w-auto max-w-full rounded object-contain shadow-2xl"
          alt={`Image ${currentIndex + 1}/${images.length}`}
          onClick={e => e.stopPropagation()}
          onWheel={e => {
            e.preventDefault();
            e.stopPropagation();
            if (images && images.length > 0) {
              if (e.deltaY > 0) {
                // 向下滚动，显示下一张
                setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
              } else {
                // 向上滚动，显示上一张
                setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
              }
            }
          }}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
          }}
        />

        {/* 右侧上下切换按钮 */}
        {hasMultipleImages && (
          <div className="absolute top-1/2 right-4 z-10 flex -translate-y-1/2 flex-col gap-2">
            <button
              className="bg-muted/50 text-foreground hover:bg-muted/70 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-150"
              onClick={handlePrevious}
            >
              <ChevronUp className="h-6 w-6" />
            </button>
            <button
              className="bg-muted/50 text-foreground hover:bg-muted/70 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-150"
              onClick={handleNext}
            >
              <ChevronDown className="h-6 w-6" />
            </button>
            {/* 快捷键提示按钮 */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="bg-muted/50 text-foreground hover:bg-muted/70 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-150"
                  onClick={e => e.stopPropagation()}
                  title={t('keyboardShortcuts')}
                >
                  <Keyboard className="h-5 w-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="left" align="start" className="bg-background/95 w-auto p-4 backdrop-blur-sm" onClick={e => e.stopPropagation()}>
                <div className="space-y-2 text-sm whitespace-nowrap">
                  <div className="border-muted/20 mb-3 flex items-center gap-2 border-b pb-2">
                    <Keyboard className="text-muted-foreground h-4 w-4" />
                    <span className="text-foreground font-medium">{t('keyboardShortcuts')}</span>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-muted-foreground">{t('previous')}</span>
                    <div className="flex items-center gap-1">
                      <kbd className="bg-muted/50 rounded px-2 py-1 font-mono text-xs">↑</kbd>
                      <span className="text-muted-foreground text-xs">or</span>
                      <kbd className="bg-muted/50 rounded px-2 py-1 font-mono text-xs">W</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-muted-foreground">{t('next')}</span>
                    <div className="flex items-center gap-1">
                      <kbd className="bg-muted/50 rounded px-2 py-1 font-mono text-xs">↓</kbd>
                      <span className="text-muted-foreground text-xs">or</span>
                      <kbd className="bg-muted/50 rounded px-2 py-1 font-mono text-xs">S</kbd>
                    </div>
                  </div>
                  {onSetCover && (
                    <div className="flex items-center justify-between gap-6">
                      <span className="text-muted-foreground">{t('setCover')}</span>
                      <kbd className="bg-muted/50 rounded px-2 py-1 font-mono text-xs">C</kbd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-muted-foreground">{t('close')}</span>
                    <kbd className="bg-muted/50 rounded px-2 py-1 font-mono text-xs">ESC</kbd>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-muted-foreground">{t('scroll')}</span>
                    <span className="text-muted-foreground text-xs">{t('navigate')}</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* 关闭按钮和设置封面按钮 */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {/* 设置封面按钮 */}
          {onSetCover && images && images.length > 0 && (
            <button
              className={`flex h-10 items-center gap-1 rounded-full px-3 text-sm transition-all duration-150 ${
                isCurrentImageCover
                  ? 'border border-yellow-400/20 bg-yellow-100/10 text-yellow-400 backdrop-blur-sm hover:bg-yellow-400/20'
                  : 'bg-muted/50 text-foreground hover:bg-muted/70'
              }`}
              onClick={handleSetCover}
              title={isCurrentImageCover ? t('currentCover') : t('setAsCover')}
            >
              <Star className={`h-4 w-4 ${isCurrentImageCover ? 'fill-current' : ''}`} />
              {isCurrentImageCover ? t('currentCover') : t('setAsCover')}
            </button>
          )}
          {/* 关闭按钮 */}
          <button
            className="bg-muted/50 text-foreground hover:bg-muted/70 flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold transition-all duration-150"
            onClick={handleCloseFullscreen}
          >
            ×
          </button>
        </div>

        {/* 图片计数器 */}
        {hasMultipleImages && (
          <div
            className="bg-muted/50 text-foreground absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full px-4 py-2 text-sm backdrop-blur-sm"
            onClick={e => e.stopPropagation()}
          >
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
