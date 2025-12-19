'use client';

import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Bold, Italic, Link, List, ListOrdered, Heading1, Heading2, Heading3, Quote, Code, Undo, Redo, Image, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useNoteAgentPanel } from '@/components/features/notes/note-agent-panel-context';

export interface WysiwygEditorToolbarProps {
  editor: Editor | null;
  rightSlot?: React.ReactNode; // 右侧自定义插槽
  onImageUploadClick?: () => void; // 图片上传按钮点击回调
  uploading?: boolean; // 是否正在上传
  noteId?: string; // 笔记ID，用于AI助手
}

export function WysiwygEditorToolbar({ editor, rightSlot, onImageUploadClick, uploading, noteId }: WysiwygEditorToolbarProps) {
  const { isOpen, togglePanel } = useNoteAgentPanel();
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const handleAIClick = () => {
    if (noteId) {
      togglePanel(noteId);
    }
  };
  // 触发工具栏更新（selection 变化不会触发 React 重新渲染，但 isActive 依赖 selection）
  const [, setToolbarTick] = useState(0);
  const toolbarRafRef = useRef<number | null>(null);

  // 监听编辑器状态变化，更新工具栏按钮状态
  useEffect(() => {
    if (!editor) return;

    const schedule = () => {
      if (toolbarRafRef.current !== null) {
        cancelAnimationFrame(toolbarRafRef.current);
      }
      toolbarRafRef.current = requestAnimationFrame(() => {
        setToolbarTick(t => t + 1);
      });
    };

    editor.on('selectionUpdate', schedule);
    editor.on('transaction', schedule);
    editor.on('focus', schedule);
    editor.on('blur', schedule);

    // 初次同步一次
    schedule();

    return () => {
      editor.off('selectionUpdate', schedule);
      editor.off('transaction', schedule);
      editor.off('focus', schedule);
      editor.off('blur', schedule);
      if (toolbarRafRef.current !== null) {
        cancelAnimationFrame(toolbarRafRef.current);
        toolbarRafRef.current = null;
      }
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border-border/40 flex items-center justify-between gap-2 border-b p-2">
      <div className="flex items-center gap-1">
        {/* AI按钮 - 放在最前面，使用特殊样式 */}
        {noteId && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAIClick}
              className={cn(
                'relative h-8 w-8 overflow-hidden p-0 transition-all',
                isOpen
                  ? 'text-foreground bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20 hover:from-purple-500/25 hover:via-blue-500/25 hover:to-cyan-500/25 dark:from-purple-400/15 dark:via-blue-400/15 dark:to-cyan-400/15 dark:hover:from-purple-400/20 dark:hover:via-blue-400/20 dark:hover:to-cyan-400/20'
                  : 'dark:from-purple-400/8 dark:via-blue-400/8 dark:to-cyan-400/8 dark:hover:from-purple-400/12 dark:hover:via-blue-400/12 dark:hover:to-cyan-400/12 text-foreground/90 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-cyan-500/10 hover:from-purple-500/15 hover:via-blue-500/15 hover:to-cyan-500/15',
              )}
              title="AI 写作助手"
            >
              <Sparkles className={cn('h-4 w-4', isOpen && 'animate-pulse')} />
            </Button>
            <div className="bg-border/40 mx-1 h-6 w-px" />
          </>
        )}
        <Button
          size="sm"
          variant={editor.isActive('bold') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="h-8 w-8 p-0"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={editor.isActive('italic') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="h-8 w-8 p-0"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={editor.isActive('link') ? 'default' : 'ghost'}
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
            } else {
              // 获取当前链接的 URL（如果选中了链接）
              const attrs = editor.getAttributes('link');
              setLinkUrl(attrs.href || '');
              setIsLinkDialogOpen(true);
            }
          }}
          className="h-8 w-8 p-0"
          title={editor.isActive('link') ? '移除链接' : '链接'}
        >
          <Link className="h-4 w-4" />
        </Button>
        <div className="bg-border/40 mx-1 h-6 w-px" />
        <Button
          size="sm"
          variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className="h-8 w-8 p-0"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className="h-8 w-8 p-0"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className="h-8 w-8 p-0"
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        <div className="bg-border/40 mx-1 h-6 w-px" />
        <Button
          size="sm"
          variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="h-8 w-8 p-0"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className="h-8 w-8 p-0"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={editor.isActive('blockquote') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className="h-8 w-8 p-0"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={editor.isActive('codeBlock') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className="h-8 w-8 p-0"
        >
          <Code className="h-4 w-4" />
        </Button>
        <div className="bg-border/40 mx-1 h-6 w-px" />
        <Button size="sm" variant="ghost" onClick={onImageUploadClick} disabled={uploading} className="h-8 w-8 p-0" title="上传图片">
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
        </Button>
        <div className="bg-border/40 mx-1 h-6 w-px" />
        <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="h-8 w-8 p-0">
          <Undo className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="h-8 w-8 p-0">
          <Redo className="h-4 w-4" />
        </Button>
      </div>
      {rightSlot && <div className="flex items-center">{rightSlot}</div>}

      {/* 链接输入 Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加链接</DialogTitle>
            <DialogDescription>请输入链接地址</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (linkUrl.trim()) {
                    editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
                    setIsLinkDialogOpen(false);
                    setLinkUrl('');
                  }
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (linkUrl.trim()) {
                  editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
                  setIsLinkDialogOpen(false);
                  setLinkUrl('');
                }
              }}
              disabled={!linkUrl.trim()}
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
