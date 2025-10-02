import { useCallback, useRef } from 'react';
import { VideoHTMLAttributes } from 'react';
import { FullscreenModal } from './fullscreen';
import { fullscreenModalRef } from './fullscreen';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const fullscreenVideoRef = useRef<fullscreenModalRef | null>(null);

  const handleDoubleClick = useCallback<NonNullable<React.DOMAttributes<HTMLVideoElement>['onDoubleClick']>>(
    (e: React.MouseEvent<HTMLVideoElement>) => {
      // 调用用户自定义的 onDoubleClick
      if (onDoubleClick) {
        onDoubleClick(e);
      }
      // 默认行为：打开全屏
      fullscreenVideoRef.current?.show(videoProps.src || '', 'video');
    },
    [onDoubleClick, videoProps.src],
  );

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
      <FullscreenModal ref={fullscreenVideoRef} />
    </>
  );
}
