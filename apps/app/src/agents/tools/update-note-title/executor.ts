import { ToolContext } from '../context';
import { prisma } from '@/lib/server/prisma';
import { updateNoteTitleParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';

export const updateNoteTitleExecutor = definitionToolExecutor(updateNoteTitleParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
    try {
      if (!context.organizationId) {
        return {
          success: false,
          error: 'Organization ID is required',
        };
      }

      const { noteId, title } = args;

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
  });
});
