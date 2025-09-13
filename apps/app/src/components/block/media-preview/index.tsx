'use client';

import { Button } from '@/components/ui/button';
import { Download, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import React from 'react';

// ==================== Types ====================
export interface MediaPreviewProps {
  src: string;
  alt: string;
  type: 'image' | 'video';
  filename: string;
  onDownload?: () => void;
  children: React.ReactNode;
}

export interface TransformState {
  scale: number;
  rotation: number;
  position: { x: number; y: number };
}

export interface DragState {
  isDragging: boolean;
  dragStart: { x: number; y: number };
}

// ==================== Hooks ====================
import { useCallback, useEffect, useState } from 'react';

export function useMediaPreview(isOpen: boolean) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 重置状态当模态框打开/关闭时
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const resetTransform = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.2, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / 1.2, 0.1));
  }, []);

  const rotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 更精确的缩放控制
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      const newScale = Math.max(0.1, Math.min(5, scale * delta));

      // 计算鼠标位置相对于图片的偏移
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // 计算缩放中心点
      const mouseX = e.clientX - centerX;
      const mouseY = e.clientY - centerY;

      // 调整位置以保持鼠标位置不变
      const scaleRatio = newScale / scale;
      setPosition(prev => ({
        x: prev.x + mouseX * (1 - scaleRatio),
        y: prev.y + mouseY * (1 - scaleRatio),
      }));

      setScale(newScale);
    },
    [scale, setPosition],
  );

  return {
    scale,
    rotation,
    position,
    isDragging,
    dragStart,
    setIsDragging,
    setDragStart,
    setPosition,
    resetTransform,
    zoomIn,
    zoomOut,
    rotate,
    handleWheel,
  };
}

export function useKeyboardShortcuts(
  isOpen: boolean,
  onClose: () => void,
  transformActions: {
    zoomIn: () => void;
    zoomOut: () => void;
    rotate: () => void;
    resetTransform: () => void;
  },
) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          e.preventDefault();
          transformActions.zoomIn();
          break;
        case '-':
          e.preventDefault();
          transformActions.zoomOut();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          transformActions.rotate();
          break;
        case '0':
          e.preventDefault();
          transformActions.resetTransform();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, transformActions]);
}

export function useDragHandlers(
  isDragging: boolean,
  dragStart: { x: number; y: number },
  position: { x: number; y: number },
  setIsDragging: (dragging: boolean) => void,
  setDragStart: (start: { x: number; y: number }) => void,
  setPosition: (pos: { x: number; y: number }) => void,
) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setDragStart({
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        });
      }
    },
    [position, setIsDragging, setDragStart],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart, setPosition],
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      setIsDragging(false);
    },
    [setIsDragging],
  );

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return { handleMouseDown };
}

// ==================== Utils ====================
export async function downloadFile(src: string, filename: string, onDownload?: () => void) {
  try {
    if (onDownload) {
      onDownload();
      return;
    }

    const response = await fetch(src);
    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('下载失败:', error);
    window.open(src, '_blank');
  }
}

// ==================== Components ====================
interface ToolbarProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onRotate: () => void;
  onDownload: () => void;
  filename: string;
}

function Toolbar({ scale, onZoomIn, onZoomOut, onReset, onRotate, onDownload, filename }: ToolbarProps) {
  return (
    <div className="absolute top-4 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-lg bg-black/50 px-4 py-2 backdrop-blur-sm">
      <Button onClick={onZoomOut} size="sm" variant="ghost" className="text-white hover:bg-white/20 hover:text-white" title="缩小 (滚轮向下)">
        <ZoomOut className="h-4 w-4" />
      </Button>

      <Button onClick={onReset} size="sm" variant="ghost" className="text-white hover:bg-white/20 hover:text-white" title="重置 (0)">
        {Math.round(scale * 100)}%
      </Button>

      <Button onClick={onZoomIn} size="sm" variant="ghost" className="text-white hover:bg-white/20 hover:text-white" title="放大 (滚轮向上)">
        <ZoomIn className="h-4 w-4" />
      </Button>

      <div className="mx-2 h-6 w-px bg-white/30" />

      <Button onClick={onRotate} size="sm" variant="ghost" className="text-white hover:bg-white/20 hover:text-white" title="旋转 (R)">
        <RotateCw className="h-4 w-4" />
      </Button>

      <div className="mx-2 h-6 w-px bg-white/30" />

      <Button onClick={onDownload} size="sm" variant="ghost" className="text-white hover:bg-white/20 hover:text-white" title={`下载 ${filename}`}>
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface CloseButtonProps {
  onClose: () => void;
}

function CloseButton({ onClose }: CloseButtonProps) {
  return (
    <Button
      onClick={onClose}
      size="sm"
      variant="ghost"
      className="absolute top-4 right-4 z-20 rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white"
      title="关闭 (Esc)"
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

interface MediaContentProps {
  src: string;
  alt: string;
  type: 'image' | 'video';
  scale: number;
  rotation: number;
  position: { x: number; y: number };
  isDragging: boolean;
  onWheel: (e: React.WheelEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

function MediaContent({ src, alt, type, scale, rotation, position, isDragging, onWheel, onMouseDown }: MediaContentProps) {
  return (
    <div
      className="flex h-[calc(100vh-12rem)] w-[calc(100vw-8rem)] items-center justify-center overflow-hidden rounded-md"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {type === 'image' ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-fit overflow-hidden rounded-md object-contain transition-transform duration-75 ease-out"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transformOrigin: 'center center',
            willChange: 'transform',
          }}
          draggable={false}
          onDragStart={e => e.preventDefault()}
        />
      ) : (
        <video
          src={src}
          controls
          className="h-full w-fit rounded-md object-contain"
          autoPlay={true}
          muted
          onDragStart={e => e.preventDefault()}
          onError={e => {
            // 忽略自动播放错误
            console.warn('Video autoplay failed:', e);
          }}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transformOrigin: 'center center',
            willChange: 'transform',
          }}
        >
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
}

interface FilenameDisplayProps {
  filename: string;
}

function FilenameDisplay({ filename }: FilenameDisplayProps) {
  return (
    <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-black/50 px-3 py-1 text-sm text-white backdrop-blur-sm">
      {filename}
    </div>
  );
}

interface PreviewTriggerProps {
  children: React.ReactNode;
  onClick: () => void;
}

function PreviewTrigger({ children, onClick }: PreviewTriggerProps) {
  return (
    <div className="cursor-pointer transition-all duration-200 hover:scale-[1.02]" onClick={onClick}>
      {children}
    </div>
  );
}

// ==================== Main Component ====================
export function MediaPreview({ src, alt, type, filename, onDownload, children }: MediaPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  const {
    scale,
    rotation,
    position,
    isDragging,
    dragStart,
    setIsDragging,
    setDragStart,
    setPosition,
    resetTransform,
    zoomIn,
    zoomOut,
    rotate,
    handleWheel,
  } = useMediaPreview(isOpen);

  const transformActions = { zoomIn, zoomOut, rotate, resetTransform };
  useKeyboardShortcuts(isOpen, () => setIsOpen(false), transformActions);

  const { handleMouseDown } = useDragHandlers(isDragging, dragStart, position, setIsDragging, setDragStart, setPosition);

  const handleDownload = useCallback(() => {
    downloadFile(src, filename, onDownload);
  }, [src, filename, onDownload]);

  if (!isOpen) {
    return <PreviewTrigger onClick={() => setIsOpen(true)}>{children}</PreviewTrigger>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

      {/* 主内容区域 */}
      <div className="relative z-10 flex h-full w-full items-center justify-center p-4">
        <Toolbar
          scale={scale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetTransform}
          onRotate={rotate}
          onDownload={handleDownload}
          filename={filename}
        />

        <CloseButton onClose={() => setIsOpen(false)} />

        <MediaContent
          src={src}
          alt={alt}
          type={type}
          scale={scale}
          rotation={rotation}
          position={position}
          isDragging={isDragging}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
        />

        <FilenameDisplay filename={filename} />
      </div>
    </div>
  );
}
