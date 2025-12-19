import { prisma } from '@/lib/server/prisma';

/**
 * 从session title中提取noteId
 * 格式：`笔记助手 - ${note.title} | noteId:${noteId}`
 */
export function extractNoteIdFromTitle(title: string | null): string | null {
  if (!title) return null;
  const match = title.match(/\| noteId:([^\|]+)/);
  return match?.[1]?.trim() ?? null;
}

/**
 * 从session中获取noteId
 */
export async function getNoteIdFromSession(sessionId: string, organizationId: string): Promise<string | null> {
  try {
    const session = await prisma.chatSessions.findUnique({
      where: {
        id: sessionId,
        organizationId,
      },
      select: {
        title: true,
      },
    });

    if (!session) return null;

    return extractNoteIdFromTitle(session.title);
  } catch (error) {
    console.error('Error getting noteId from session:', error);
    return null;
  }
}

