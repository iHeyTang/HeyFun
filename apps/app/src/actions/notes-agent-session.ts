'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';

/**
 * Notes Agent Sessions Actions
 * 管理笔记中的 Agent 会话
 */

// 创建笔记 Agent 会话
export const createNotesAgentSession = withUserAuth(
  'notes-agent-session/createNotesAgentSession',
  async ({ orgId, args }: AuthWrapperContext<{ noteId: string; title?: string }>) => {
    const { noteId, title } = args;

    try {
      // 验证笔记是否存在
      const note = await prisma.notes.findUnique({
        where: {
          id: noteId,
          organizationId: orgId,
          isDeleted: false,
        },
      });

      if (!note) {
        throw new Error('笔记不存在');
      }

      // 创建会话，将 noteId 存储在 title 中（格式：`笔记助手 - ${note.title} | noteId:${noteId}`）
      const sessionTitle = title || `笔记助手 - ${note.title} | noteId:${noteId}`;

      const session = await prisma.chatSessions.create({
        data: {
          organizationId: orgId,
          title: sessionTitle,
          agentId: 'notes', // 使用 notes agent
          status: 'idle',
          modelProvider: null,
          modelId: null,
        },
      });

      // 在 session 的 metadata 中存储 noteId（通过 JSON 字段）
      // 由于 ChatSessions 表没有 metadata 字段，我们可以通过其他方式
      // 这里我们创建一个关联表或者在 workflow 中通过其他方式传递
      // 暂时先返回 session，noteId 会在 workflow 中通过其他方式传递

      return { ...session, noteId };
    } catch (error) {
      console.error('Error creating notes agent session:', error);
      throw error;
    }
  },
);

// 获取笔记的 Agent 会话列表
export const getNotesAgentSessions = withUserAuth(
  'notes-agent-session/getNotesAgentSessions',
  async ({ orgId, args }: AuthWrapperContext<{ noteId: string }>) => {
    const { noteId } = args;

    try {
      // 验证笔记是否存在
      const note = await prisma.notes.findUnique({
        where: {
          id: noteId,
          organizationId: orgId,
          isDeleted: false,
        },
      });

      if (!note) {
        throw new Error('笔记不存在');
      }

      // 查找所有与笔记相关的会话（通过 title 中的 noteId 匹配）
      const sessions = await prisma.chatSessions.findMany({
        where: {
          organizationId: orgId,
          agentId: 'notes',
          deletedAt: null,
          title: {
            contains: `noteId:${noteId}`,
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10, // 最多返回10个会话
      });

      return sessions;
    } catch (error) {
      console.error('Error getting notes agent sessions:', error);
      throw error;
    }
  },
);

// 获取或创建笔记的默认 Agent 会话
export const getOrCreateNotesAgentSession = withUserAuth(
  'notes-agent-session/getOrCreateNotesAgentSession',
  async ({ orgId, args }: AuthWrapperContext<{ noteId: string }>) => {
    const { noteId } = args;

    try {
      // 验证笔记是否存在
      const note = await prisma.notes.findUnique({
        where: {
          id: noteId,
          organizationId: orgId,
          isDeleted: false,
        },
      });

      if (!note) {
        throw new Error('笔记不存在');
      }

      // 查找最近的会话（通过 title 中的 noteId 匹配）
      const recentSession = await prisma.chatSessions.findFirst({
        where: {
          organizationId: orgId,
          agentId: 'notes',
          deletedAt: null,
          title: {
            contains: `noteId:${noteId}`,
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (recentSession) {
        return { ...recentSession, noteId };
      }

      // 如果没有找到，创建新会话
      const session = await prisma.chatSessions.create({
        data: {
          organizationId: orgId,
          title: `笔记助手 - ${note.title} | noteId:${noteId}`,
          agentId: 'notes',
          status: 'idle',
          modelProvider: null,
          modelId: null,
        },
      });

      return { ...session, noteId };
    } catch (error) {
      console.error('Error getting or creating notes agent session:', error);
      throw error;
    }
  },
);

