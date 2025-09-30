import { createPortal } from 'react-dom';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ImgHTMLAttributes } from 'react';
import { FullscreenModal } from './fullscreen';
import { fullscreenModalRef } from './fullscreen';

interface ImagePreviewProps extends ImgHTMLAttributes<HTMLImageElement> {}

export function ImagePreview({ onDoubleClick, className = '', ...imgProps }: ImagePreviewProps) {
  const imageFullscreenModalRef = useRef<fullscreenModalRef | null>(null);
  const handleDoubleClick = useCallback<NonNullable<React.DOMAttributes<HTMLImageElement>['onDoubleClick']>>(
    e => {
      // 调用用户自定义的 onDoubleClick
      if (onDoubleClick) {
        onDoubleClick(e);
      }
      imageFullscreenModalRef.current?.show(imgProps.src || '', 'image');
    },
    [onDoubleClick],
  );

  // 合并默认样式和用户自定义样式
  const defaultClassName = 'cursor-pointer';
  const finalClassName = className ? `${defaultClassName} ${className}` : defaultClassName;

  return (
    <>
      <div className="relative">
        <img {...imgProps} className={finalClassName} onDoubleClick={handleDoubleClick} />
      </div>

      {/* 全屏模态窗口 */}
      <FullscreenModal ref={imageFullscreenModalRef} />
    </>
  );
}
