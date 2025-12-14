import { createPortal } from 'react-dom';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ImgHTMLAttributes } from 'react';
import { FullscreenModal } from './fullscreen';
import { fullscreenModalRef } from './fullscreen';

interface ImagePreviewProps extends ImgHTMLAttributes<HTMLImageElement> {}

export function ImagePreview({ onClick, onDoubleClick, className = '', ...imgProps }: ImagePreviewProps) {
  const imageFullscreenModalRef = useRef<fullscreenModalRef | null>(null);
  const handleClick = useCallback<NonNullable<React.DOMAttributes<HTMLImageElement>['onClick']>>(
    e => {
      // 调用用户自定义的 onClick
      if (onClick) {
        onClick(e);
      }
      imageFullscreenModalRef.current?.show(imgProps.src || '', 'image');
    },
    [onClick, imgProps.src],
  );
  const handleDoubleClick = useCallback<NonNullable<React.DOMAttributes<HTMLImageElement>['onDoubleClick']>>(
    e => {
      // 调用用户自定义的 onDoubleClick
      if (onDoubleClick) {
        onDoubleClick(e);
      }
      imageFullscreenModalRef.current?.show(imgProps.src || '', 'image');
    },
    [onDoubleClick, imgProps.src],
  );

  // 合并默认样式和用户自定义样式
  const defaultClassName = 'cursor-pointer';
  const finalClassName = className ? `${defaultClassName} ${className}` : defaultClassName;

  return (
    <>
      <img {...imgProps} className={finalClassName} onClick={handleClick} onDoubleClick={handleDoubleClick} />

      {/* 全屏模态窗口 */}
      <FullscreenModal ref={imageFullscreenModalRef} />
    </>
  );
}
