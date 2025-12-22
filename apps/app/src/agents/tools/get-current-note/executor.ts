import { ToolResult } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { prisma } from '@/lib/server/prisma';
import storage from '@/lib/server/storage';

export async function getCurrentNoteExecutor(args: any, context: ToolContext): Promise<ToolResult> {
  try {
    if (!context.organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
      };
    }

    const { noteId } = args;
    if (!noteId || typeof noteId !== 'string') {
      return {
        success: false,
        error: 'Note ID is required and must be a string',
      };
    }

    // 获取笔记内容
    const note = await prisma.notes.findUnique({
      where: {
        id: noteId,
        organizationId: context.organizationId,
        isDeleted: false,
      },
      select: {
        id: true,
        title: true,
        contentKey: true,
      },
    });

    if (!note) {
      return {
        success: false,
        error: 'Note not found',
      };
    }

    // 从OSS读取内容
    let content = '';
    try {
      const contentBuffer = await storage.getBytes(note.contentKey);
      if (contentBuffer) {
        content = Buffer.from(contentBuffer).toString('utf-8');
      }
    } catch (error) {
      console.error('Error reading note content from OSS:', error);
    }

    return {
      success: true,
      data: {
        id: note.id,
        title: note.title,
        content,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

