'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface NoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function NoteEditor({ value, onChange, placeholder = '开始记录你的想法...', className, autoFocus = false }: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // 自动调整高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  // 处理 Tab 键（插入两个空格，而不是切换焦点）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);

      // 恢复光标位置
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // 处理粘贴事件，保留 markdown 格式
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // 允许默认粘贴行为，保留 markdown 格式
    // 如果需要特殊处理，可以在这里添加逻辑
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        className={cn(
          'flex-1 resize-none border-none bg-transparent p-6 font-mono text-sm',
          'focus:outline-none focus:ring-0',
          'placeholder:text-muted-foreground',
          'leading-relaxed',
        )}
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        }}
      />
    </div>
  );
}
