import { ToolResult } from '@/agents/core/tools/tool-definition';
import { NotesToolboxContext } from '../context';
import { getNoteIdFromSession } from '../utils';
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
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*.*?\*\*/g, '')
    .replace(/\*.*?\*/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
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

    const { startLine, endLine, content } = args;
    if (typeof startLine !== 'number' || typeof endLine !== 'number') {
      return {
        success: false,
        error: 'Start line and end line are required and must be numbers',
      };
    }
    if (!content || typeof content !== 'string') {
      return {
        success: false,
        error: 'Content is required and must be a string',
      };
    }

    if (startLine < 1 || endLine < 1 || startLine > endLine) {
      return {
        success: false,
        error: 'Invalid line range. Start line and end line must be >= 1, and start line must be <= end line',
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

    // 获取现有笔记内容
    const note = await prisma.notes.findUnique({
      where: {
        id: noteId,
        organizationId: context.organizationId,
        isDeleted: false,
      },
      select: {
        contentKey: true,
      },
    });

    if (!note) {
      return {
        success: false,
        error: 'Note not found',
      };
    }

    // 从OSS读取现有内容
    const contentBuffer = await storage.getBytes(note.contentKey);
    const existingContent = contentBuffer ? Buffer.from(contentBuffer).toString('utf-8') : '';
    const lines = existingContent.split('\n');

    // 替换内容（转换为0-based索引）
    const startIndex = startLine - 1;
    const endIndex = endLine; // endLine是包含的，所以用endLine作为结束索引
    lines.splice(startIndex, endIndex - startIndex, content);

    const newContent = lines.join('\n');

    // 计算内容哈希
    const contentHash = calculateContentHash(newContent);
    const contentText = extractTextFromMarkdown(newContent);

    // 生成新的 OSS key
    const newContentKey = `${context.organizationId}/notes/${Date.now()}_${nanoid(8)}.md`;

    // 上传新内容到 OSS
    await storage.put(newContentKey, Buffer.from(newContent, 'utf-8'), {
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
        message: 'Content replaced successfully',
        noteId,
        replacedLines: `${startLine}-${endLine}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

export const replaceNoteContentTool = {
  toolName: 'replace_note_content',
  executor,
};

