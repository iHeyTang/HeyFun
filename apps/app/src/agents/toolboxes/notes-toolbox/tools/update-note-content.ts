import { ToolResult } from '@/agents/core/tools/tool-definition';
import { NotesToolboxContext } from '../context';
import { getNoteIdFromSession } from '../utils';
import { updateNote } from '@/actions/notes';
import { prisma } from '@/lib/server/prisma';
import storage from '@/lib/server/storage';
import { createHash } from 'crypto';

function calculateContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function extractTextFromMarkdown(markdown: string): string {
  if (!markdown) {
    return '';
  }
  // 简单的 Markdown 文本提取：移除代码块、链接、图片等
  return markdown
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/`[^`]+`/g, '') // 移除行内代码
    .replace(/!\[.*?\]\(.*?\)/g, '') // 移除图片
    .replace(/\[.*?\]\(.*?\)/g, '') // 移除链接
    .replace(/#{1,6}\s+/g, '') // 移除标题标记
    .replace(/\*\*.*?\*\*/g, '') // 移除粗体
    .replace(/\*.*?\*/g, '') // 移除斜体
    .replace(/^\s*[-*+]\s+/gm, '') // 移除列表标记
    .replace(/^\s*\d+\.\s+/gm, '') // 移除有序列表标记
    .trim();
}
import { nanoid } from 'nanoid';

const executor = async (args: any, context: NotesToolboxContext): Promise<ToolResult> => {
  try {
    if (!context.sessionId || !context.organizationId) {
      return {
        success: false,
        error: 'Session ID and Organization ID are required',
      };
    }

    const { content } = args;
    if (!content || typeof content !== 'string') {
      return {
        success: false,
        error: 'Content is required and must be a string',
      };
    }

    // 从session中获取noteId
    const noteId = await getNoteIdFromSession(context.sessionId, context.organizationId);
    if (!noteId) {
      return {
        success: false,
        error: 'Note ID not found in session. Please ensure you are using a notes agent session.',
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
};

export const updateNoteContentTool = {
  toolName: 'update_note_content',
  executor,
};

