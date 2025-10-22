'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import CHAT from '@repo/llm/chat';

// 创建聊天会话
export const createChatSession = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ modelId: string; title?: string; agentId?: string }>) => {
  const { modelId, title, agentId } = args;

  try {
    const session = await prisma.chatSessions.create({
      data: {
        organizationId: orgId,
        modelId,
        title: title || null,
        agentId: agentId || null,
        status: 'active',
        modelProvider: '',
      },
    });

    return session;
  } catch (error) {
    console.error('Error creating chat session:', error);
    throw error;
  }
});

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

// 一次性聊天
export const chatOnce = withUserAuth(async ({ args }: AuthWrapperContext<{ modelId: string; content: string }>) => {
  const { modelId, content } = args;
  const llmClient = CHAT.createClient(modelId);
  const result = await llmClient.chat({
    messages: [{ role: 'user', content }],
  });

  return result;
});
