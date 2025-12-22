import { ToolResult } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { prisma } from '@/lib/server/prisma';
import storage from '@/lib/server/storage';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';

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

export async function insertNoteContentExecutor(args: any, context: ToolContext): Promise<ToolResult> {
  try {
    if (!context.organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
      };
    }

    const { noteId, lineNumber, content } = args;
    if (!noteId || typeof noteId !== 'string') {
      return {
        success: false,
        error: 'Note ID is required and must be a string',
      };
    }
    if (typeof lineNumber !== 'number') {
      return {
        success: false,
        error: 'Line number is required and must be a number',
      };
    }
    if (!content || typeof content !== 'string') {
      return {
        success: false,
        error: 'Content is required and must be a string',
      };
    }

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

    // 插入内容
    const insertIndex = lineNumber <= 0 ? 0 : lineNumber > lines.length ? lines.length : lineNumber - 1;
    lines.splice(insertIndex, 0, content);

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
        message: 'Content inserted successfully',
        noteId,
        insertedAtLine: insertIndex + 1,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

