import { useCallback, useMemo, useRef } from 'react';
import { NodeOutput } from '../../flowcanvas';
import { FullscreenModal, fullscreenModalRef } from './fullscreen';

interface ImagePreviewProps {
  images?: NodeOutput['images'];
  className?: string;
  onLoad?: () => void;
  onSetCover?: (key: string) => void;
}

export function ImagePreview({ images, className, onLoad, onSetCover }: ImagePreviewProps) {
  const imageFullscreenModalRef = useRef<fullscreenModalRef | null>(null);
  const handleDoubleClick = useCallback<NonNullable<React.DOMAttributes<HTMLImageElement>['onDoubleClick']>>(
    e => {
      imageFullscreenModalRef.current?.show({ coverKey: images?.selected, images: images?.list });
    },
    [images],
  );

  // 合并默认样式和用户自定义样式
  const defaultClassName = 'cursor-pointer';
  const finalClassName = className ? `${defaultClassName} ${className}` : defaultClassName;

  const coverUrl = useMemo(() => {
    const key = images?.selected && images?.list?.includes(images?.selected) ? images?.selected : images?.list?.[0];
    return key ? `/api/oss/${key}` : undefined;
  }, [images]);

  return (
    <>
      <div className="relative">
        {images?.list?.length && images?.list?.length > 1 && (
          <div className="absolute right-2 top-2 z-10 flex items-center justify-center rounded-full border border-white/10 bg-black/20 px-2 py-1 backdrop-blur-md">
            <span className="text-xs font-medium text-white">{images?.list?.length}</span>
          </div>
        )}
        <img src={coverUrl || ''} className={finalClassName} onDoubleClick={handleDoubleClick} onLoad={onLoad} />
      </div>

      {/* 全屏模态窗口 */}
      <FullscreenModal ref={imageFullscreenModalRef} onSetCover={onSetCover} />
    </>
  );
}
