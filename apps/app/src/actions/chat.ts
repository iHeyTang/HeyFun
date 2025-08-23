'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';

// 创建聊天会话
export const createChatSession = withUserAuth(
  async ({ orgId, args }: AuthWrapperContext<{ modelProvider: string; modelId: string; title?: string }>) => {
    const { modelProvider, modelId, title } = args;

    try {
      const session = await prisma.chatSessions.create({
        data: {
          organizationId: orgId,
          modelProvider,
          modelId,
          title: title || null,
          status: 'active',
        },
      });

      return session;
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
  },
);

// 获取用户的聊天会话列表
export const getChatSessions = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ page?: number; pageSize?: number }>) => {
  const { page = 1, pageSize = 20 } = args || {};

  try {
    const sessions = await prisma.chatSessions.findMany({
      where: {
        organizationId: orgId,
        status: 'active',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1, // 只取第一条消息用于显示预览
        },
      },
    });

    const total = await prisma.chatSessions.count({
      where: {
        organizationId: orgId,
        status: 'active',
      },
    });

    return { sessions, total };
  } catch (error) {
    console.error('Error getting chat sessions:', error);
    throw error;
  }
});

// 获取特定会话的详细信息和消息
export const getChatSession = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ sessionId: string }>) => {
  const { sessionId } = args;

  try {
    const session = await prisma.chatSessions.findUnique({
      where: {
        id: sessionId,
        organizationId: orgId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    return session;
  } catch (error) {
    console.error('Error getting chat session:', error);
    throw error;
  }
});

// 发送消息并获取AI回复
export const sendMessage = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ sessionId: string; content: string }>) => {
  const { sessionId, content } = args;

  try {
    // 验证会话存在
    const session = await prisma.chatSessions.findUnique({
      where: {
        id: sessionId,
        organizationId: orgId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // 创建用户消息记录
    const userMessage = await prisma.chatMessages.create({
      data: {
        sessionId,
        organizationId: orgId,
        role: 'user',
        content,
        isComplete: true,
      },
    });

    // 创建AI消息记录（初始为空，用于流式更新）
    const aiMessage = await prisma.chatMessages.create({
      data: {
        sessionId,
        organizationId: orgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        isComplete: false,
      },
    });

    // 更新会话的最后更新时间
    await prisma.chatSessions.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    // 如果是第一条消息，自动生成会话标题
    if (session.messages.length === 0 && !session.title) {
      const title = content.length > 50 ? content.substring(0, 50) + '...' : content;
      await prisma.chatSessions.update({
        where: { id: sessionId },
        data: { title },
      });
    }

    return {
      userMessage,
      aiMessage,
    };
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
});

// 更新会话标题
export const updateSessionTitle = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ sessionId: string; title: string }>) => {
  const { sessionId, title } = args;

  try {
    const session = await prisma.chatSessions.update({
      where: {
        id: sessionId,
        organizationId: orgId,
      },
      data: { title },
    });

    return session;
  } catch (error) {
    console.error('Error updating session title:', error);
    throw error;
  }
});

// 删除会话（归档）
export const deleteSession = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ sessionId: string }>) => {
  const { sessionId } = args;

  try {
    await prisma.chatSessions.update({
      where: {
        id: sessionId,
        organizationId: orgId,
      },
      data: { status: 'archived' },
    });

    return;
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
});

// 删除消息
export const deleteMessage = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ messageId: string }>) => {
  const { messageId } = args;

  try {
    // 验证消息属于该组织
    const message = await prisma.chatMessages.findUnique({
      where: {
        id: messageId,
        organizationId: orgId,
      },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    await prisma.chatMessages.delete({
      where: { id: messageId },
    });

    return;
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
});
