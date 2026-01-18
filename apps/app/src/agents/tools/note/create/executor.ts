import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { prisma } from '@/lib/server/prisma';
import { NoteService } from '@/service/note';
import { noteCreateParamsSchema } from './schema';

export const noteCreateExecutor = definitionToolExecutor(noteCreateParamsSchema, async (args, context) => {
  try {
    if (!context.organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
      };
    }

    if (!context.sessionId) {
      return {
        success: false,
        error: 'Session ID is required',
      };
    }

    const { title, content, folderId } = args;

    // 使用 server 层创建笔记
    const result = await NoteService.createNote(context.organizationId, {
      title,
      content,
      folderId,
    });

    // 确定 session 类型
    const [chatSession, flowcanvasSession] = await Promise.all([
      prisma.chatSessions.findUnique({
        where: { id: context.sessionId },
        select: { id: true },
      }),
      prisma.flowCanvasProjectAgentSessions.findUnique({
        where: { id: context.sessionId },
        select: { id: true },
      }),
    ]);

    const sessionType = chatSession ? 'chat' : flowcanvasSession ? 'flowcanvas' : null;

    if (!sessionType) {
      // 笔记已创建，但无法关联到 session
      return {
        success: true,
        data: {
          noteId: result.note.id,
          title: result.note.title,
          message: 'Note created but could not be associated with session assets',
        },
      };
    }

    // 创建 Asset 记录，将笔记关联到当前 session
    const asset = await prisma.assets.create({
      data: {
        organizationId: context.organizationId,
        sessionId: context.sessionId,
        sessionType,
        type: 'document',
        fileKey: result.contentKey,
        fileName: `${title.trim()}.md`,
        fileSize: Buffer.byteLength(content, 'utf-8'),
        mimeType: 'text/markdown',
        title: title.trim(),
        description: `笔记: ${title.trim()}`,
        metadata: {
          noteId: result.note.id,
          source: 'note_create_tool',
        },
        toolCallId: context.toolCallId,
        messageId: context.messageId,
      },
    });

    return {
      success: true,
      data: {
        noteId: result.note.id,
        title: result.note.title,
        assetId: asset.id,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
