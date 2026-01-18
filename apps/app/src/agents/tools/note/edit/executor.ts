import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { prisma } from '@/lib/server/prisma';
import { NoteService } from '@/service/note';
import { noteEditParamsSchema } from './schema';

export const noteEditExecutor = definitionToolExecutor(noteEditParamsSchema, async (args, context) => {
  try {
    if (!context.organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
      };
    }

    const { noteId, title, edits, fullContent } = args;

    // 使用 server 层编辑笔记
    const result = await NoteService.editNote(context.organizationId, {
      noteId,
      title,
      edits,
      fullContent,
    });

    // 更新关联的 Assets 记录（如果存在）
    if (context.sessionId && result.contentKey) {
      // 获取新内容的大小
      const note = await NoteService.getNote(context.organizationId, noteId, true);
      const contentSize = note?.content ? Buffer.byteLength(note.content, 'utf-8') : 0;

      await prisma.assets.updateMany({
        where: {
          organizationId: context.organizationId,
          metadata: {
            path: ['noteId'],
            equals: noteId,
          },
        },
        data: {
          fileKey: result.contentKey,
          fileSize: contentSize,
          title: result.title,
          fileName: `${result.title}.md`,
        },
      });
    }

    const responseData: any = {
      noteId: result.noteId,
      title: result.title,
      editCount: result.editCount,
    };

    if (result.failedEdits && result.failedEdits.length > 0) {
      responseData.failedEdits = result.failedEdits;
    }

    return {
      success: true,
      data: responseData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
