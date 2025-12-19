import { ToolResult } from '@/agents/core/tools/tool-definition';
import { NotesToolboxContext } from '../context';
import { getNoteIdFromSession } from '../utils';
import { prisma } from '@/lib/server/prisma';

const executor = async (args: any, context: NotesToolboxContext): Promise<ToolResult> => {
  try {
    if (!context.sessionId || !context.organizationId) {
      return {
        success: false,
        error: 'Session ID and Organization ID are required',
      };
    }

    const { title } = args;
    if (!title || typeof title !== 'string') {
      return {
        success: false,
        error: 'Title is required and must be a string',
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
};

export const updateNoteTitleTool = {
  toolName: 'update_note_title',
  executor,
};

