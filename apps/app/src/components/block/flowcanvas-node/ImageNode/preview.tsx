import { createPortal } from 'react-dom';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ImgHTMLAttributes } from 'react';
import { FullscreenModal, fullscreenModalRef } from './fullscreen';

interface ImagePreviewProps {
  coverKey?: string;
  images?: { key: string; url: string }[];
  className?: string;
  onLoad?: () => void;
  onSetCover?: (key: string) => void;
}

export function ImagePreview({ coverKey, images, className, onLoad, onSetCover }: ImagePreviewProps) {
  const imageFullscreenModalRef = useRef<fullscreenModalRef | null>(null);
  const handleDoubleClick = useCallback<NonNullable<React.DOMAttributes<HTMLImageElement>['onDoubleClick']>>(
    e => {
      imageFullscreenModalRef.current?.show({ coverKey, images });
    },
    [coverKey],
  );

  // 合并默认样式和用户自定义样式
  const defaultClassName = 'cursor-pointer';
  const finalClassName = className ? `${defaultClassName} ${className}` : defaultClassName;

  const coverUrl = useMemo(() => {
    return images?.find(image => image.key === coverKey)?.url || images?.[0]?.url;
  }, [coverKey, images]);

  return (
    <>
      <div className="relative">
        {images?.length && images.length > 1 && (
          <div className="absolute top-2 right-2 z-10 flex items-center justify-center rounded-full border border-white/10 bg-black/20 px-2 py-1 backdrop-blur-md">
            <span className="text-xs font-medium text-white">{images.length}</span>
          </div>
        )}
        <img src={coverUrl || ''} className={finalClassName} onDoubleClick={handleDoubleClick} onLoad={onLoad} />
      </div>

      {/* 全屏模态窗口 */}
      <FullscreenModal ref={imageFullscreenModalRef} onSetCover={onSetCover} />
    </>
  );
}
