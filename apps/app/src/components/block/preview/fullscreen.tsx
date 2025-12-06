import { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { createPortal } from 'react-dom';

export interface fullscreenModalRef {
  show: (url: string, type: 'image' | 'video') => void;
}

export interface FullscreenModalProps {
  ref?: React.RefObject<fullscreenModalRef | null>;
}

// 全屏模态窗口组件
export function FullscreenModal({ ref }: FullscreenModalProps) {
  const [url, setUrl] = useState<string | undefined>();
  const [type, setType] = useState<'image' | 'video' | undefined>();
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  useImperativeHandle(ref, () => ({
    show: (url: string, type: 'image' | 'video') => {
      setUrl(url);
      setType(type);
      setIsClosing(false);
      setIsOpening(true);
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
    }, 200); // 与动画时间保持一致
  }, []);

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
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ease-out ${
        isClosing || isOpening ? 'opacity-0 backdrop-blur-0' : 'bg-background/90 opacity-100 backdrop-blur-sm'
      }`}
      onClick={handleCloseFullscreen}
    >
      <div
        className={`relative flex h-full w-full items-center justify-center transition-all duration-200 ease-out ${
          isClosing || isOpening ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {type === 'image' ? (
          <img
            src={url}
            className="h-auto max-h-full w-auto max-w-full rounded object-contain shadow-2xl"
            alt="Fullscreen image"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
            }}
          />
        ) : (
          <video
            src={url}
            className="h-auto max-h-full w-auto max-w-full rounded object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
            controls
            loop
            autoPlay
          />
        )}
        <button
          className="bg-muted/50 text-foreground hover:bg-muted/70 absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold transition-all duration-150"
          onClick={handleCloseFullscreen}
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}
