import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoHTMLAttributes } from 'react';

interface VideoPreviewProps extends VideoHTMLAttributes<HTMLVideoElement> {
  autoPlayOnHover?: boolean;
}

export function VideoPreview({
  autoPlayOnHover = true,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
  className = '',
  ...videoProps
}: VideoPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);

  const handleDoubleClick = useCallback<NonNullable<React.DOMAttributes<HTMLVideoElement>['onDoubleClick']>>(
    (e: React.MouseEvent<HTMLVideoElement>) => {
      // 调用用户自定义的 onDoubleClick
      if (onDoubleClick) {
        onDoubleClick(e);
      }
      // 默认行为：打开全屏
      setIsFullscreen(true);
    },
    [onDoubleClick],
  );

  const handleCloseFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  // 处理鼠标移入事件
  const handleMouseEnter = useCallback<NonNullable<React.DOMAttributes<HTMLVideoElement>['onMouseEnter']>>(
    (e: React.MouseEvent<HTMLVideoElement>) => {
      // 调用用户自定义的 onMouseEnter
      if (onMouseEnter) {
        onMouseEnter(e);
      }
      // 默认行为：自动播放
      if (videoRef.current && autoPlayOnHover) {
        videoRef.current.play().catch(error => {
          console.warn('视频自动播放失败:', error);
        });
      }
    },
    [autoPlayOnHover, onMouseEnter],
  );

  // 处理鼠标移出事件
  const handleMouseLeave = useCallback<NonNullable<React.DOMAttributes<HTMLVideoElement>['onMouseLeave']>>(
    (e: React.MouseEvent<HTMLVideoElement>) => {
      // 调用用户自定义的 onMouseLeave
      if (onMouseLeave) {
        onMouseLeave(e);
      }
      // 默认行为：暂停视频
      if (videoRef.current) {
        videoRef.current.pause();
      }
    },
    [onMouseLeave],
  );

  // 处理全屏视频播放状态同步
  useEffect(() => {
    if (isFullscreen && fullscreenVideoRef.current && videoRef.current) {
      // 同步播放状态
      if (!videoRef.current.paused) {
        fullscreenVideoRef.current.play().catch(console.warn);
      } else {
        fullscreenVideoRef.current.pause();
      }
    }
  }, [isFullscreen]);

  // 合并默认样式和用户自定义样式
  const defaultClassName = 'cursor-pointer';
  const finalClassName = className ? `${defaultClassName} ${className}` : defaultClassName;

  return (
    <>
      <div className="relative">
        <video
          ref={videoRef}
          {...videoProps}
          className={finalClassName}
          onDoubleClick={handleDoubleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {/* 全屏模态窗口 */}
      {isFullscreen && videoProps.src && (
        <VideoFullscreenModal videoUrl={videoProps.src} onClose={handleCloseFullscreen} videoRef={fullscreenVideoRef} />
      )}
    </>
  );
}

// 全屏视频模态窗口组件
function VideoFullscreenModal({
  videoUrl,
  onClose,
  videoRef,
}: {
  videoUrl: string;
  onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  return createPortal(
    <div className="bg-theme-background/90 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex h-full w-full items-center justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-auto max-h-full w-auto max-w-full rounded object-contain shadow-2xl"
          onClick={e => e.stopPropagation()}
          controls
          loop
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
          }}
        />
        <button
          className="bg-theme-muted/50 text-theme-foreground hover:bg-theme-muted/70 absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold transition-colors"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}
