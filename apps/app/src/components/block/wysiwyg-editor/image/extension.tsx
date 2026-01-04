'use client';

import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ImagePreview } from '@/components/block/preview/image-preview';
import { cn } from '@/lib/utils';

/**
 * 图片 NodeView 组件
 */
const ImageNodeView = ({ node, updateAttributes, getPos, editor }: any) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const aspectRatioRef = useRef<number | null>(null);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startWidthRef = useRef(0);
  const startHeightRef = useRef(0);

  const rawSrc = node.attrs.src || '';
  const width = node.attrs.width;
  const height = node.attrs.height ?? 200;
  const isPlaceholder = node.attrs['data-placeholder-id'];

  // 处理 oss:// 协议，转换为 /api/oss/ 路径
  const src = useMemo(() => {
    if (rawSrc.startsWith('oss://')) {
      const fileKey = rawSrc.replace('oss://', '');
      return `/api/oss/${fileKey}`;
    }
    return rawSrc;
  }, [rawSrc]);

  // 获取内部的 img 元素
  const getImgElement = useCallback(() => {
    return wrapperRef.current?.querySelector('img') as HTMLImageElement | null;
  }, []);

  // 计算宽高比
  const updateAspectRatio = useCallback(() => {
    const img = getImgElement();
    if (img && img.naturalWidth && img.naturalHeight) {
      aspectRatioRef.current = img.naturalWidth / img.naturalHeight;
    }
  }, [getImgElement]);

  // 图片加载完成处理
  const handleImageLoad = useCallback(() => {
    updateAspectRatio();
  }, [updateAspectRatio]);

  // 图片加载失败处理
  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    console.error('图片加载失败:', img.src);
    img.style.opacity = '0.3';
  }, []);

  // 开始调整大小
  const startResize = useCallback(
    (e: React.MouseEvent) => {
      const img = getImgElement();
      if (!img) return;

      e.preventDefault();
      e.stopPropagation();
      isResizingRef.current = true;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      startWidthRef.current = img.offsetWidth;
      startHeightRef.current = img.offsetHeight;

      if (!aspectRatioRef.current && img.naturalWidth && img.naturalHeight) {
        aspectRatioRef.current = img.naturalWidth / img.naturalHeight;
      }

      const onMouseMove = (e: MouseEvent) => {
        const img = getImgElement();
        if (!img || !isResizingRef.current) return;

        const deltaX = e.clientX - startXRef.current;
        const deltaY = e.clientY - startYRef.current;

        // 使用较大的变化量来保持比例
        const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;

        let newWidth = startWidthRef.current + delta;
        let newHeight = aspectRatioRef.current ? newWidth / aspectRatioRef.current : startHeightRef.current + deltaY;

        // 限制最小尺寸
        if (newWidth < 50) {
          newWidth = 50;
          newHeight = aspectRatioRef.current ? newWidth / aspectRatioRef.current : newHeight;
        }
        if (newHeight < 50) {
          newHeight = 50;
          newWidth = aspectRatioRef.current ? newHeight * aspectRatioRef.current : newWidth;
        }

        img.style.width = `${newWidth}px`;
        img.style.height = `${newHeight}px`;
      };

      const onMouseUp = () => {
        if (!isResizingRef.current) return;
        const img = getImgElement();
        if (!img) return;

        isResizingRef.current = false;

        const finalWidth = img.offsetWidth;
        const finalHeight = img.offsetHeight;

        const pos = getPos();
        if (typeof pos === 'number') {
          updateAttributes({
            width: finalWidth,
            height: finalHeight,
          });
        }

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [getImgElement, getPos, updateAttributes],
  );

  // 处理图片上的鼠标按下事件（Shift + 点击）
  const handleImageMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey) {
        startResize(e);
      }
    },
    [startResize],
  );

  // 处理调整控制点的鼠标按下事件
  const handleResizeHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      startResize(e);
    },
    [startResize],
  );

  // 如果图片已经加载完成，立即计算宽高比
  useEffect(() => {
    const img = getImgElement();
    if (img && img.complete && img.naturalWidth > 0) {
      aspectRatioRef.current = img.naturalWidth / img.naturalHeight;
    }
  }, [src, getImgElement]);

  return (
    <NodeViewWrapper as="div" ref={wrapperRef} className="image-wrapper group relative inline-block max-w-full rounded transition-all">
      <ImagePreview
        src={src}
        alt={node.attrs.alt || ''}
        className={cn('block cursor-move rounded', isPlaceholder && 'opacity-60')}
        style={{
          objectFit: 'contain',
          display: 'block',
          marginTop: 0,
          marginBottom: 0,
          width: width ? (typeof width === 'number' ? `${width}px` : String(width)) : undefined,
          height: typeof height === 'number' ? `${height}px` : String(height),
        }}
        onLoad={handleImageLoad}
        onError={handleImageError}
        onMouseDown={handleImageMouseDown}
      />
      {/* 调整大小的控制点（不可见但可交互） */}
      <div
        ref={resizeHandleRef}
        className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-nwse-resize"
        style={{
          opacity: 0,
          pointerEvents: 'auto',
          margin: '-2px',
        }}
        onMouseDown={handleResizeHandleMouseDown}
      />
    </NodeViewWrapper>
  );
};

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => {
          const width = element.getAttribute('width');
          return width ? parseInt(width, 10) : null;
        },
        renderHTML: attributes => {
          if (!attributes.width) {
            return {};
          }
          return {
            width: attributes.width,
          };
        },
      },
      height: {
        default: 200, // 默认高度为 200px
        parseHTML: element => {
          const height = element.getAttribute('height');
          return height ? parseInt(height, 10) : 200;
        },
        renderHTML: attributes => {
          if (!attributes.height) {
            return {};
          }
          return {
            height: attributes.height,
          };
        },
      },
      'data-placeholder-id': {
        default: null,
        parseHTML: element => element.getAttribute('data-placeholder-id'),
        renderHTML: attributes => {
          if (!attributes['data-placeholder-id']) {
            return {};
          }
          return {
            'data-placeholder-id': attributes['data-placeholder-id'],
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
}).configure({
  inline: true,
  allowBase64: true, // 允许 base64 图片，用于显示上传占位符
});
