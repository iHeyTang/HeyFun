import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { NoteService } from '@/service/note';
import { noteReadParamsSchema } from './schema';

export const noteReadExecutor = definitionToolExecutor(noteReadParamsSchema, async (args, context) => {
  try {
    if (!context.organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
      };
    }

    const { noteId } = args;

    // 使用 server 层获取笔记
    const note = await NoteService.getNote(context.organizationId, noteId, true);

    if (!note) {
      return {
        success: false,
        error: 'Note not found',
      };
    }

    return {
      success: true,
      data: {
        noteId: note.id,
        title: note.title,
        content: note.content,
        folderId: note.folderId,
        folderName: note.folder?.name || null,
        tags: note.tags?.map((tag: any) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
        })),
        isPinned: note.isPinned,
        isStarred: note.isStarred,
        isArchived: note.isArchived,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
