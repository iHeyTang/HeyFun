import { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';

export interface fullscreenModalRef {
  show: (data: { coverKey?: string; images?: { key: string; url: string }[] }) => void;
}

export interface FullscreenModalProps {
  ref?: React.RefObject<fullscreenModalRef | null>;
  onSetCover?: (key: string) => void;
}

// 全屏模态窗口组件
export function FullscreenModal({ ref, onSetCover }: FullscreenModalProps) {
  const [coverKey, setCoverKey] = useState<string | undefined>();
  const [images, setImages] = useState<{ key: string; url: string }[] | undefined>();
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useImperativeHandle(ref, () => ({
    show: (data: { coverKey?: string; images?: { key: string; url: string }[] }) => {
      setCoverKey(data.coverKey);
      setImages(data.images);
      setIsClosing(false);
      setIsOpening(true);
      // 找到 coverKey 对应的索引
      if (data.coverKey && data.images) {
        const index = data.images.findIndex(img => img.key === data.coverKey);
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
        const newCoverKey = images[currentIndex].key;
        // 立即更新本地状态，使UI立刻响应
        setCoverKey(newCoverKey);
        // 调用父组件回调
        onSetCover(newCoverKey);
      }
    },
    [images, currentIndex, onSetCover],
  );

  // 监听全局 Escape 和箭头键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseFullscreen();
      } else if (e.key === 'ArrowLeft') {
        if (images && images.length > 0) {
          setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
        }
      } else if (e.key === 'ArrowRight') {
        if (images && images.length > 0) {
          setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleCloseFullscreen, images]);

  if (!images || images.length === 0) {
    return null;
  }

  const currentImage = images[currentIndex];
  const hasMultipleImages = images.length > 1;
  const isCurrentImageCover = coverKey && currentImage && currentImage.key === coverKey;

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
        {/* 主图片 */}
        <img
          src={currentImage?.url}
          className="h-auto max-h-full w-auto max-w-full rounded object-contain shadow-2xl"
          alt={`Image ${currentIndex + 1}/${images.length}`}
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
          }}
        />

        {/* 左右切换按钮 */}
        {hasMultipleImages && (
          <>
            <button
              className="bg-muted/50 text-foreground hover:bg-muted/70 absolute top-1/2 left-4 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-150"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              className="bg-muted/50 text-foreground hover:bg-muted/70 absolute top-1/2 right-4 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-150"
              onClick={handleNext}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
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
              title={isCurrentImageCover ? 'Current cover' : 'Set as cover'}
            >
              <Star className={`h-4 w-4 ${isCurrentImageCover ? 'fill-current' : ''}`} />
              {isCurrentImageCover ? 'Current cover' : 'Set as cover'}
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

        {/* 缩略图导航 */}
        {hasMultipleImages && images.length <= 10 && (
          <div className="absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 gap-2" onClick={e => e.stopPropagation()}>
            {images.map((img, idx) => (
              <button
                key={img.key}
                className={`h-16 w-16 overflow-hidden rounded border-2 transition-all duration-150 ${
                  idx === currentIndex ? 'border-primary scale-110' : 'border-muted/50 hover:border-muted/70'
                }`}
                onClick={e => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
              >
                <img src={img.url} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
