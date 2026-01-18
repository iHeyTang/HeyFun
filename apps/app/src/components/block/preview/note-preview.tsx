'use client';

import { useCallback, useImperativeHandle, useRef, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, X, ExternalLink, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNote } from '@/actions/notes';
import ReactMarkdown from 'react-markdown';
import { useRouter } from 'next/navigation';
import { WysiwygEditor } from '@/components/block/wysiwyg-editor';

export interface notePreviewModalRef {
  show: (noteId: string, title?: string) => void;
}

export interface NotePreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  noteId: string;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
}

// 笔记内容预览组件（直接展示笔记内容）
export interface NoteContentPreviewProps {
  noteId: string;
  className?: string;
}

// 笔记全屏模态组件
export const NoteFullscreenModal = forwardRef<notePreviewModalRef, {}>((props, ref) => {
  const router = useRouter();
  const [noteId, setNoteId] = useState<string | undefined>();
  const [title, setTitle] = useState<string | undefined>();
  const [content, setContent] = useState<string | undefined>();
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    show: (id: string, noteTitle?: string) => {
      setNoteId(id);
      setTitle(noteTitle);
      setContent(undefined);
      setError(null);
      setIsClosing(false);
      setIsOpening(true);
      setIsLoading(true);
      // 在下一帧触发打开动画
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsOpening(false);
        });
      });
      // 获取笔记内容
      getNote({ noteId: id })
        .then(result => {
          if (result.error) {
            setError(result.error);
            setIsLoading(false);
          } else if (result.data) {
            setContent(result.data.content || '');
            setIsLoading(false);
          }
        })
        .catch(err => {
          setError(err.message || '加载笔记失败');
          setIsLoading(false);
        });
    },
  }));

  const handleCloseFullscreen = useCallback(() => {
    setIsClosing(true);
    // 等待动画完成后再关闭
    setTimeout(() => {
      setNoteId(undefined);
      setContent(undefined);
      setError(null);
      setIsClosing(false);
      setIsLoading(true);
    }, 200);
  }, []);

  const handleOpenInEditor = useCallback(() => {
    if (noteId) {
      router.push(`/dashboard/notes/${noteId}`);
    }
  }, [noteId, router]);

  // 监听全局 Escape 键和阻止 body 滚动
  useEffect(() => {
    if (!noteId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [noteId, handleCloseFullscreen]);

  if (!noteId) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200 ease-out',
        isClosing || isOpening ? 'opacity-0 backdrop-blur-0' : 'bg-background/95 opacity-100 backdrop-blur-sm',
      )}
      onClick={handleCloseFullscreen}
    >
      <div
        className={cn(
          'bg-card relative flex h-[90vh] w-full max-w-4xl flex-col rounded-lg border shadow-xl transition-all duration-200 ease-out',
          isClosing || isOpening ? 'scale-95 opacity-0' : 'scale-100 opacity-100',
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="bg-muted/50 flex shrink-0 items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <StickyNote className="text-primary h-5 w-5" />
            <h2 className="text-lg font-semibold">{title || '笔记预览'}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenInEditor}>
              <ExternalLink className="mr-2 h-4 w-4" />
              在编辑器中打开
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCloseFullscreen}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 内容区域 - 使用相对/绝对定位确保滚动正常工作 */}
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 overflow-y-auto p-6">
            {isLoading && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Loader2 className="text-muted-foreground mx-auto mb-4 h-8 w-8 animate-spin" />
                  <div className="text-muted-foreground text-sm">正在加载笔记...</div>
                </div>
              </div>
            )}
            {error && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="text-destructive mb-4 text-sm">{error}</div>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                    重试
                  </Button>
                </div>
              </div>
            )}
            {content && !isLoading && !error && (
              <div className="markdown-body prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
});

NoteFullscreenModal.displayName = 'NoteFullscreenModal';

// 笔记内容预览组件（直接展示笔记内容）
export function NoteContentPreview({ noteId, className }: NoteContentPreviewProps) {
  const [noteContent, setNoteContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    if (!noteId) {
      return;
    }

    let cancelled = false;

    // 使用函数更新状态，避免同步 setState
    const loadNote = async () => {
      setLoadingContent(true);

      try {
        const result = await getNote({ noteId });
        if (!cancelled) {
          if (result.error) {
            console.error('加载笔记失败:', result.error);
            setNoteContent(null);
          } else if (result.data?.content) {
            setNoteContent(result.data.content);
          }
        }
      } catch {
        // 忽略错误
      } finally {
        if (!cancelled) {
          setLoadingContent(false);
        }
      }
    };

    loadNote();

    return () => {
      cancelled = true;
    };
  }, [noteId]);

  if (loadingContent) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="text-muted-foreground/50 h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!noteContent) {
    return null;
  }

  return (
    <div className={className}>
      <WysiwygEditor value={noteContent} readOnly={true} showToolbar={false} isStreaming={false} className="text-xs" editorClassName="p-2" />
    </div>
  );
}

export function NotePreview({ noteId, title, className, onClick, onDoubleClick, ...props }: NotePreviewProps) {
  const noteFullscreenModalRef = useRef<notePreviewModalRef | null>(null);

  const handleClick = useCallback<NonNullable<React.DOMAttributes<HTMLDivElement>['onClick']>>(
    e => {
      // 调用用户自定义的 onClick
      if (onClick) {
        onClick(e);
      }
      // 默认行为：打开全屏
      if (noteId) {
        noteFullscreenModalRef.current?.show(noteId, title);
      }
    },
    [onClick, noteId, title],
  );

  const handleDoubleClick = useCallback<NonNullable<React.DOMAttributes<HTMLDivElement>['onDoubleClick']>>(
    e => {
      // 调用用户自定义的 onDoubleClick
      if (onDoubleClick) {
        onDoubleClick(e);
      }
      // 默认行为：打开全屏
      if (noteId) {
        noteFullscreenModalRef.current?.show(noteId, title);
      }
    },
    [onDoubleClick, noteId, title],
  );

  // 合并默认样式和用户自定义样式
  const defaultClassName = 'cursor-pointer';
  const finalClassName = className ? `${defaultClassName} ${className}` : defaultClassName;

  return (
    <>
      <div
        className={cn(
          'bg-muted/30 hover:border-foreground/20 group relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border transition-all hover:shadow-md',
          finalClassName,
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{ minHeight: '100px' }}
        {...props}
      >
        {/* 卡片内容 */}
        <div className="relative z-0 flex flex-col items-center justify-center p-6 text-center">
          <StickyNote className="mb-3 h-8 w-8 text-blue-600 transition-transform group-hover:scale-110 dark:text-blue-400" />
          <div className="text-muted-foreground mb-1 text-sm font-medium transition-colors">{title || '笔记'}</div>
          <div className="text-muted-foreground/70 mt-2 text-xs">点击查看预览</div>
        </div>

        {/* 悬停遮罩 */}
        <div
          className={cn(
            'absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/60 transition-opacity',
            'opacity-0 group-hover:opacity-100',
          )}
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex flex-col gap-2" style={{ pointerEvents: 'auto' }}>
            <Button
              variant="default"
              size="sm"
              onClick={e => {
                e.stopPropagation();
                if (noteId) {
                  noteFullscreenModalRef.current?.show(noteId, title);
                }
              }}
              className="flex items-center gap-2"
            >
              打开预览
            </Button>
          </div>
        </div>
      </div>

      {/* 全屏模态窗口 */}
      <NoteFullscreenModal ref={noteFullscreenModalRef} />
    </>
  );
}
