import { ToolResult } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { prisma } from '@/lib/server/prisma';

export async function updateNoteTitleExecutor(args: any, context: ToolContext): Promise<ToolResult> {
  try {
    if (!context.organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
      };
    }

    const { noteId, title } = args;
    if (!noteId || typeof noteId !== 'string') {
      return {
        success: false,
        error: 'Note ID is required and must be a string',
      };
    }
    if (!title || typeof title !== 'string') {
      return {
        success: false,
        error: 'Title is required and must be a string',
      };
    }

    // 更新笔记标题
    await prisma.notes.update({
      where: {
        id: noteId,
        organizationId: context.organizationId,
        isDeleted: false,
      },
      data: {
        title: title.trim(),
      },
    });

    return {
      success: true,
      data: {
        message: 'Note title updated successfully',
        noteId,
        title: title.trim(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

