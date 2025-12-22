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

export async function updateNoteContentExecutor(args: any, context: ToolContext): Promise<ToolResult> {
  try {
    if (!context.organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
      };
    }

    const { noteId, content } = args;
    if (!noteId || typeof noteId !== 'string') {
      return {
        success: false,
        error: 'Note ID is required and must be a string',
      };
    }
    if (!content || typeof content !== 'string') {
      return {
        success: false,
        error: 'Content is required and must be a string',
      };
    }

    // 获取现有笔记
    const existingNote = await prisma.notes.findUnique({
      where: {
        id: noteId,
        organizationId: context.organizationId,
        isDeleted: false,
      },
    });

    if (!existingNote) {
      return {
        success: false,
        error: 'Note not found',
      };
    }

    // 计算内容哈希
    const contentHash = calculateContentHash(content);
    const contentText = extractTextFromMarkdown(content);

    // 如果内容哈希相同，不需要更新
    if (contentHash === existingNote.contentHash) {
      return {
        success: true,
        data: {
          message: 'Content unchanged',
          noteId,
        },
      };
    }

    // 生成新的 OSS key
    const newContentKey = `${context.organizationId}/notes/${Date.now()}_${nanoid(8)}.md`;

    // 上传新内容到 OSS
    await storage.put(newContentKey, Buffer.from(content, 'utf-8'), {
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
        message: 'Note content updated successfully',
        noteId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

