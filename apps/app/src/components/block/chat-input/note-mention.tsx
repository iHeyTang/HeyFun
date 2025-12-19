'use client';

import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NoteMentionData {
  startLine: number;
  startColumn: number;
  endLine?: number;
  endColumn?: number;
  content: string;
}

/**
 * 解析mention文本：@note[行:列:内容] 或 @note[行:列-行:列:内容]
 */
export function parseNoteMention(text: string): NoteMentionData | null {
  const match = text.match(/^@note\[(\d+):(\d+)(?:-(\d+):(\d+))?:(.+)\]$/);
  if (!match) return null;

  const [, startLineStr, startColStr, endLineStr, endColStr, content] = match;
  const startLine = parseInt(startLineStr || '0', 10);
  const startColumn = parseInt(startColStr || '0', 10);
  const endLine = endLineStr ? parseInt(endLineStr, 10) : undefined;
  const endColumn = endColStr ? parseInt(endColStr, 10) : undefined;

  return {
    startLine,
    startColumn,
    endLine,
    endColumn,
    content: content || '',
  };
}

/**
 * 解析文本中的所有mention
 */
export function parseMentions(text: string): Array<{ start: number; end: number; data: NoteMentionData }> {
  const mentions: Array<{ start: number; end: number; data: NoteMentionData }> = [];
  const regex = /@note\[(\d+):(\d+)(?:-(\d+):(\d+))?:(.+?)\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const data = parseNoteMention(match[0]);
    if (data) {
      mentions.push({ start, end, data });
    }
  }

  return mentions;
}

interface NoteMentionBadgeProps {
  data: NoteMentionData;
  onRemove?: () => void;
  className?: string;
}

/**
 * Note Mention Badge 组件
 */
export function NoteMentionBadge({ data, onRemove, className }: NoteMentionBadgeProps) {
  const { startLine, startColumn, endLine, endColumn, content } = data;

  // 构建位置显示文本
  let positionText = `行${startLine}:列${startColumn}`;
  if (endLine && endColumn && (endLine !== startLine || endColumn !== startColumn)) {
    positionText = `行${startLine}:列${startColumn}-行${endLine}:列${endColumn}`;
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        'group inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium',
        'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-600/20',
        'dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-400/30',
        'hover:bg-blue-200 dark:hover:bg-blue-900/40',
        className,
      )}
    >
      <span className="font-semibold">@笔记</span>
      <span className="text-blue-700 dark:text-blue-400">{positionText}</span>
      {content && (
        <span className="max-w-[100px] truncate text-blue-600 dark:text-blue-400" title={content}>
          {content}
        </span>
      )}
      {onRemove && (
        <button
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-sm opacity-0 transition-opacity hover:bg-blue-300/50 group-hover:opacity-100 dark:hover:bg-blue-800/50"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}
