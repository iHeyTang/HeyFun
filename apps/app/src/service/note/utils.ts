/**
 * Note Server - 工具函数
 */

import { createHash } from 'crypto';
import { EditOperation } from './types';

/**
 * 从 Markdown 中提取纯文本（用于搜索）
 */
export function extractTextFromMarkdown(markdown: string): string {
  if (!markdown) {
    return '';
  }

  const text = markdown
    // 移除代码块
    .replace(/```[\s\S]*?```/g, '')
    // 移除行内代码
    .replace(/`[^`]*`/g, '')
    // 移除链接，保留文本
    .replace(/\[([^\]]*)\]\([^\)]*\)/g, '$1')
    // 移除图片
    .replace(/!\[([^\]]*)\]\([^\)]*\)/g, '')
    // 移除标题标记
    .replace(/^#{1,6}\s+/gm, '')
    // 移除粗体和斜体标记
    .replace(/\*\*([^\*]*)\*\*/g, '$1')
    .replace(/\*([^\*]*)\*/g, '$1')
    .replace(/__([^_]*)__/g, '$1')
    .replace(/_([^_]*)_/g, '$1')
    // 移除列表标记
    .replace(/^[\*\-\+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // 移除引用标记
    .replace(/^>\s+/gm, '')
    // 移除水平线
    .replace(/^---+$/gm, '')
    // 移除多余空白
    .replace(/\n\s*\n/g, '\n')
    .trim();

  return text;
}

/**
 * 计算内容哈希值（用于版本控制和去重）
 */
export function calculateContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * 应用 diff 编辑操作
 */
export function applyEdits(
  content: string,
  edits: EditOperation[],
): {
  newContent: string;
  successCount: number;
  failedEdits: Array<{ oldText: string; reason: string }>;
} {
  let newContent = content;
  let successCount = 0;
  const failedEdits: Array<{ oldText: string; reason: string }> = [];

  for (const edit of edits) {
    const { oldText, newText } = edit;

    if (!newContent.includes(oldText)) {
      failedEdits.push({
        oldText: oldText.length > 50 ? oldText.substring(0, 50) + '...' : oldText,
        reason: 'Text not found in note content',
      });
      continue;
    }

    // 只替换第一次出现的位置
    newContent = newContent.replace(oldText, newText);
    successCount++;
  }

  return { newContent, successCount, failedEdits };
}
