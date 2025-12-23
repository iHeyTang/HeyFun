import { ToolContext } from '../context';
import { prisma } from '@/lib/server/prisma';
import storage from '@/lib/server/storage';
import { getCurrentNoteParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';

export const getCurrentNoteExecutor = definitionToolExecutor(
  getCurrentNoteParamsSchema,
  async (args, context) => {
    return await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
      try {
        if (!context.organizationId) {
        return {
          success: false,
          error: 'Organization ID is required',
        };
      }

      const { noteId } = args;

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
    });
  },
);

