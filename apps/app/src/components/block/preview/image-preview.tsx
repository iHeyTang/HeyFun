import { createPortal } from 'react-dom';
import { useCallback, useState } from 'react';
import { ImgHTMLAttributes } from 'react';

interface ImagePreviewProps extends ImgHTMLAttributes<HTMLImageElement> {}

export function ImagePreview({ onDoubleClick, className = '', ...imgProps }: ImagePreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleDoubleClick = useCallback<NonNullable<React.DOMAttributes<HTMLImageElement>['onDoubleClick']>>(
    e => {
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

  // 合并默认样式和用户自定义样式
  const defaultClassName = 'cursor-pointer';
  const finalClassName = className ? `${defaultClassName} ${className}` : defaultClassName;

  return (
    <>
      <div className="relative">
        <img {...imgProps} className={finalClassName} onDoubleClick={handleDoubleClick} />
      </div>

      {/* 全屏模态窗口 */}
      {isFullscreen && imgProps.src && <ImageFullscreenModal imageUrl={imgProps.src} onClose={handleCloseFullscreen} />}
    </>
  );
}

// 全屏模态窗口组件
function ImageFullscreenModal({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  return createPortal(
    <div className="bg-background/90 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex h-full w-full items-center justify-center">
        <img
          src={imageUrl}
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
        <button
          className="bg-muted/50 text-foreground hover:bg-muted/70 absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold transition-colors"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}
