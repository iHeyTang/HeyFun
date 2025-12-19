'use client';

import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sparkles, Highlighter, Hand, Type, Bold, Link, MessageCircle } from 'lucide-react';
import { forwardRef, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface SelectionInfo {
  text: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

interface SelectionToolbarProps {
  editor: Editor | null;
  onAddToAgent?: (selectionInfo: SelectionInfo) => void;
}

export const SelectionToolbar = forwardRef<HTMLDivElement, SelectionToolbarProps>(({ editor, onAddToAgent }, ref) => {
  const [, setToolbarTick] = useState(0);
  const toolbarRafRef = useRef<number | null>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

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

    return () => {
      editor.off('selectionUpdate', schedule);
      editor.off('transaction', schedule);
      if (toolbarRafRef.current !== null) {
        cancelAnimationFrame(toolbarRafRef.current);
        toolbarRafRef.current = null;
      }
    };
  }, [editor]);

  // 获取选中文本的位置信息（行数和列数）
  const getSelectionInfo = (): SelectionInfo | null => {
    if (!editor) return null;

    const { from, to } = editor.state.selection;
    if (from === to) return null;

    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    const textBeforeStart = editor.state.doc.textBetween(0, from, '\n');
    const textBeforeEnd = editor.state.doc.textBetween(0, to, '\n');

    // 计算行数（基于换行符）
    const startLine = textBeforeStart.split('\n').length;
    const endLine = textBeforeEnd.split('\n').length;

    // 计算列数（当前行的字符位置）
    const startLineText = textBeforeStart.split('\n').pop() || '';
    const endLineText = textBeforeEnd.split('\n').pop() || '';
    const startColumn = startLineText.length + 1;
    const endColumn = endLineText.length + 1;

    return {
      text: selectedText,
      startLine,
      startColumn,
      endLine,
      endColumn,
    };
  };

  const handleAddToAgent = () => {
    if (!onAddToAgent || !editor) return;

    const selectionInfo = getSelectionInfo();
    if (selectionInfo && selectionInfo.text.trim()) {
      onAddToAgent(selectionInfo);
      // 取消选择
      editor.commands.blur();
    }
  };

  if (!editor) return null;

  const handleLinkClick = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
    } else {
      // 获取当前链接的 URL（如果选中了链接）
      const attrs = editor.getAttributes('link');
      setLinkUrl(attrs.href || '');
      setIsLinkDialogOpen(true);
    }
  };

  const handleLinkSubmit = () => {
    if (linkUrl.trim()) {
      editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
      setIsLinkDialogOpen(false);
      setLinkUrl('');
    }
  };

  const handleLinkDialogClose = (open: boolean) => {
    setIsLinkDialogOpen(open);
    if (!open) {
      setLinkUrl('');
    }
  };

  return (
    <>
      <div ref={ref} className="inline-flex">
        {/* 工具栏 */}
        <div className="border-border/40 bg-background/95 flex items-center gap-0.5 rounded-lg border px-1.5 py-1 shadow-lg backdrop-blur-sm">
          {/* 高亮按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  // TODO: 实现高亮功能
                }}
                className="h-7 w-7 p-0"
              >
                <Highlighter className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-800 text-white dark:bg-gray-700">
              高亮
            </TooltipContent>
          </Tooltip>

          {/* 粗体按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={editor.isActive('bold') ? 'default' : 'ghost'}
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={cn('h-7 w-7 p-0', editor.isActive('bold') && 'bg-gray-200 dark:bg-gray-700')}
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-800 text-white dark:bg-gray-700">
              粗体
            </TooltipContent>
          </Tooltip>

          {/* 链接按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={editor.isActive('link') ? 'default' : 'ghost'}
                onClick={handleLinkClick}
                className={cn('h-7 w-7 p-0', editor.isActive('link') && 'bg-gray-200 dark:bg-gray-700')}
              >
                <Link className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-800 text-white dark:bg-gray-700">
              {editor.isActive('link') ? '移除链接' : '链接'}
            </TooltipContent>
          </Tooltip>

          {/* 聊天按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={handleAddToAgent} className="h-7 gap-1.5 px-2 text-xs">
                <div className="relative inline-flex items-center justify-center">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <span>Chat</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-800 text-white dark:bg-gray-700">
              Chat
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 链接输入 Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={handleLinkDialogClose}>
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
                  handleLinkSubmit();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleLinkDialogClose(false)}>
              取消
            </Button>
            <Button onClick={handleLinkSubmit} disabled={!linkUrl.trim()}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

SelectionToolbar.displayName = 'SelectionToolbar';
