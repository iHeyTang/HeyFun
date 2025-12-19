'use client';

import { WysiwygEditor } from './index';
import { cn } from '@/lib/utils';

export interface WysiwygRendererProps {
  content: string; // Markdown 格式的字符串
  className?: string;
  isStreaming?: boolean; // 是否正在流式输出
}

/**
 * WysiwygRenderer - 基于 WysiwygEditor 的只读渲染器
 * 用于统一渲染所有 Markdown 格式的内容
 */
export function WysiwygRenderer({ content, className, isStreaming = false }: WysiwygRendererProps) {
  return (
    <div className={cn('wysiwyg-renderer', className)} data-streaming={isStreaming}>
      <WysiwygEditor
        value={content}
        readOnly={true}
        showToolbar={false}
        isStreaming={isStreaming}
        className={cn('min-h-0', className)}
      />
    </div>
  );
}

