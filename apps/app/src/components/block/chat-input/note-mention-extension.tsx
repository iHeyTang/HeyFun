'use client';

import Mention, { MentionOptions } from '@tiptap/extension-mention';
import { ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { X, FileText } from 'lucide-react';
import { useState } from 'react';

export interface NoteMentionData {
  noteId?: string; // 笔记ID
  noteTitle?: string; // 笔记名称
  startLine: number;
  startColumn: number;
  endLine?: number;
  endColumn?: number;
  content?: string; // 选中的内容文本
}

/**
 * 解析mention文本
 * 格式：@note:{noteId}[line:line][content]
 * 例如：@note:abc123[1:5][这是选中的内容]
 */
export function parseNoteMention(text: string): NoteMentionData | null {
  // 格式：@note:{noteId}[line:line][content]
  // 例如：@note:abc123[1:5][这是选中的内容]
  // 或者：@note:abc123[1][这是选中的内容] (单行)
  const match = text.match(/^@note:([^[]+)\[(\d+)(?::(\d+))?\](?:\[([^\]]*)\])?$/);
  if (match) {
    const [, noteId, startLineStr, endLineStr, content] = match;
    const startLine = parseInt(startLineStr || '1', 10);
    const endLine = endLineStr ? parseInt(endLineStr, 10) : undefined;

    return {
      noteId: noteId || undefined,
      startLine,
      startColumn: 1,
      endLine,
      endColumn: endLine ? 1 : undefined,
      content: content || undefined,
    };
  }

  return null;
}

/**
 * Note Mention NodeView 组件
 */
const NoteMentionNodeView: React.FC<NodeViewProps> = ({ node, deleteNode }) => {
  const data = node.attrs.data as NoteMentionData;
  const { noteTitle, startLine, startColumn, endLine, endColumn } = data || {};
  const [isHovered, setIsHovered] = useState(false);

  if (!data) {
    return (
      <NodeViewWrapper as="span" className={cn('mention mention-warning', 'px-[1px]')} data-type="note-mention">
        @笔记[无效]
      </NodeViewWrapper>
    );
  }

  // 构建位置显示文本（只显示行数，使用冒号）
  let positionText = `:${startLine}`;
  if (endLine && endLine !== startLine) {
    positionText = `:${startLine}-${endLine}`;
  }

  // 显示笔记名称（如果有），否则显示"笔记"
  const displayTitle = noteTitle || '笔记';

  return (
    <NodeViewWrapper
      as="span"
      className={cn(
        'mention group inline-flex items-center gap-1 px-2 text-[11px] font-medium',
        'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-600/20',
        'dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-400/30',
        'hover:bg-blue-200 dark:hover:bg-blue-900/40',
        'cursor-pointer rounded-md',
        'px-[1px]',
      )}
      data-type="note-mention"
      data-line={startLine}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {deleteNode && (
        <button
          onClick={e => {
            e.stopPropagation();
            deleteNode();
          }}
          className="flex items-center justify-center rounded-sm transition-colors hover:bg-blue-300/50 dark:hover:bg-blue-800/50"
          aria-label="删除引用"
        >
          {isHovered ? <X className="h-3 w-3 text-blue-700 dark:text-blue-400" /> : <FileText className="h-3 w-3 text-blue-600 dark:text-blue-400" />}
        </button>
      )}
      <span className="font-semibold">{displayTitle}</span>
      <span className="text-blue-700 dark:text-blue-400">{positionText}</span>
    </NodeViewWrapper>
  );
};

/**
 * 创建 Note Mention 扩展
 */
export function createNoteMentionExtension() {
  return Mention.extend({
    addNodeView() {
      return ReactNodeViewRenderer(NoteMentionNodeView);
    },
    addAttributes() {
      return {
        data: {
          default: null,
          parseHTML: element => {
            // 优先从 data-note-mention 属性获取
            const mentionText = element.getAttribute('data-note-mention') || element.textContent || '';
            const noteId = element.getAttribute('data-note-id') || undefined;
            const noteTitle = element.getAttribute('data-note-title') || undefined;
            const content = element.getAttribute('data-note-content') || undefined;
            const parsed = parseNoteMention(mentionText);
            if (parsed) {
              if (noteId) parsed.noteId = noteId;
              if (noteTitle) parsed.noteTitle = noteTitle;
              if (content) parsed.content = content;
            }
            return parsed;
          },
          renderHTML: attributes => {
            if (!attributes.data) return {};
            const { noteId, noteTitle, startLine, endLine, content } = attributes.data;
            let positionInfo = `${startLine}`;
            if (endLine && endLine !== startLine) {
              positionInfo = `${startLine}:${endLine}`;
            }
            // 构建新格式：@note:{noteId}[line:line][content]
            let mentionText = `@note:${noteId || ''}[${positionInfo}]`;
            if (content) {
              mentionText += `[${content}]`;
            }
            const htmlAttrs: Record<string, string> = {
              'data-note-mention': mentionText,
            };
            if (noteId) {
              htmlAttrs['data-note-id'] = noteId;
            }
            if (noteTitle) {
              htmlAttrs['data-note-title'] = noteTitle;
            }
            if (content) {
              htmlAttrs['data-note-content'] = content;
            }
            return htmlAttrs;
          },
        },
      };
    },
  }).configure({
    renderText: ({ node }) => {
      const data = node.attrs.data as NoteMentionData;
      if (!data) return '@note:unknown[0]';
      const { noteId, startLine, endLine, content } = data;
      let positionInfo = `${startLine}`;
      if (endLine && endLine !== startLine) {
        positionInfo = `${startLine}:${endLine}`;
      }
      // 格式：@note:{noteId}[line:line][content]
      let mentionText = `@note:${noteId || 'unknown'}[${positionInfo}]`;
      if (content) {
        mentionText += `[${content}]`;
      }
      return mentionText;
    },
    HTMLAttributes: {
      class: 'mention note-mention',
    },
    // 禁用suggestion（因为我们通过程序化插入）
    suggestion: false as any,
  });
}
