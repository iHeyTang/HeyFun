import { ToolResult } from '@/agents/core/tools/tool-definition';
import { NotesToolboxContext } from '../context';
import { getNoteIdFromSession } from '../utils';
import { getNote } from '@/actions/notes';
import { prisma } from '@/lib/server/prisma';

const executor = async (args: any, context: NotesToolboxContext): Promise<ToolResult> => {
  try {
    if (!context.sessionId || !context.organizationId) {
      return {
        success: false,
        error: 'Session ID and Organization ID are required',
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

    // 获取笔记内容
    // 注意：这里需要直接调用prisma，因为getNote是server action，需要auth context
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
    const storage = (await import('@/lib/server/storage')).default;
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
};

export const getCurrentNoteTool = {
  toolName: 'get_current_note',
  executor,
};

