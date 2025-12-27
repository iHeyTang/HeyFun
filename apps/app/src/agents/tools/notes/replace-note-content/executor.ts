import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { prisma } from '@/lib/server/prisma';
import storage from '@/lib/server/storage';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import { replaceNoteContentParamsSchema } from './schema';

function calculateContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function extractTextFromMarkdown(markdown: string): string {
  if (!markdown) {
    return '';
  }
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*.*?\*\*/g, '')
    .replace(/\*.*?\*/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .trim();
}

export const replaceNoteContentExecutor = definitionToolExecutor(replaceNoteContentParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
    try {
      if (!context.organizationId) {
        return {
          success: false,
          error: 'Organization ID is required',
        };
      }

      const { noteId, startLine, endLine, content } = args;

      // 获取现有笔记内容
      const note = await prisma.notes.findUnique({
        where: {
          id: noteId,
          organizationId: context.organizationId,
          isDeleted: false,
        },
        select: {
          contentKey: true,
        },
      });

      if (!note) {
        return {
          success: false,
          error: 'Note not found',
        };
      }

      // 从OSS读取现有内容
      const contentBuffer = await storage.getBytes(note.contentKey);
      const existingContent = contentBuffer ? Buffer.from(contentBuffer).toString('utf-8') : '';
      const lines = existingContent.split('\n');

      // 替换内容（转换为0-based索引）
      const startIndex = startLine - 1;
      const endIndex = endLine; // endLine是包含的，所以用endLine作为结束索引
      lines.splice(startIndex, endIndex - startIndex, content);

      const newContent = lines.join('\n');

      // 计算内容哈希
      const contentHash = calculateContentHash(newContent);
      const contentText = extractTextFromMarkdown(newContent);

      // 生成新的 OSS key
      const newContentKey = `${context.organizationId}/notes/${Date.now()}_${nanoid(8)}.md`;

      // 上传新内容到 OSS
      await storage.put(newContentKey, Buffer.from(newContent, 'utf-8'), {
        contentType: 'text/markdown',
      });

      // 更新笔记
      await prisma.notes.update({
        where: { id: noteId },
        data: {
          contentKey: newContentKey,
          contentHash,
          contentText,
        },
      });

      return {
        success: true,
        data: {
          message: 'Content replaced successfully',
          noteId,
          replacedLines: `${startLine}-${endLine}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
});
