'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import CHAT from '@/llm/chat';
import { loadModelDefinitionsFromDatabase } from './llm';

// 创建聊天会话
export const createChatSession = withUserAuth(
  'chat/createChatSession',
  async ({ orgId, args }: AuthWrapperContext<{ title?: string; agentId?: string }>) => {
    const { title, agentId } = args;

    try {
      const session = await prisma.chatSessions.create({
        data: {
          organizationId: orgId,
          title: title || null,
          agentId: agentId || null,
          status: 'idle',
          modelProvider: null,
          modelId: null,
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
export const getChatSessions = withUserAuth(
  'chat/getChatSessions',
  async ({ orgId, args }: AuthWrapperContext<{ page?: number; pageSize?: number }>) => {
    const { page = 1, pageSize = 20 } = args || {};

    try {
      const sessions = await prisma.chatSessions.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null, // 排除已删除的会话
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
      });

      const total = await prisma.chatSessions.count({
        where: {
          organizationId: orgId,
          deletedAt: null, // 排除已删除的会话
        },
      });

      return { sessions, total };
    } catch (error) {
      console.error('Error getting chat sessions:', error);
      throw error;
    }
  },
);

// 获取特定会话的详细信息和消息
export const getChatSession = withUserAuth('chat/getChatSession', async ({ orgId, args }: AuthWrapperContext<{ sessionId: string }>) => {
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

// 删除会话（软删除）
export const deleteSession = withUserAuth('chat/deleteSession', async ({ orgId, args }: AuthWrapperContext<{ sessionId: string }>) => {
  const { sessionId } = args;

  try {
    await prisma.chatSessions.update({
      where: {
        id: sessionId,
        organizationId: orgId,
      },
      data: { deletedAt: new Date() },
    });

    return;
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
});

// 删除消息
export const deleteMessage = withUserAuth('chat/deleteMessage', async ({ orgId, args }: AuthWrapperContext<{ messageId: string }>) => {
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
export const chatOnce = withUserAuth('chat/chatOnce', async ({ orgId, args }: AuthWrapperContext<{ modelId: string; content: string }>) => {
  const { modelId, content } = args;

  // 从数据库加载模型列表并设置到 CHAT 实例
  const models = await loadModelDefinitionsFromDatabase();
  CHAT.setModels(models);

  // 获取模型信息用于计算费用
  const modelInfo = models.find(m => m.id === modelId);
  if (!modelInfo) {
    throw new Error(`Model ${modelId} not found`);
  }

  // 在调用前检查余额（估算）
  const { calculateLLMCost, checkCreditsBalance, deductCredits } = await import('@/lib/server/credit');
  const estimatedOutputTokens = 1000;
  const estimatedCost = calculateLLMCost(modelInfo, 0, estimatedOutputTokens);
  const hasBalance = await checkCreditsBalance(orgId, estimatedCost);
  if (!hasBalance) {
    throw new Error('Insufficient credits balance');
  }

  const llmClient = CHAT.createClient(modelId);
  const result = await llmClient.chat({
    messages: [{ role: 'user', content }],
  });

  // 计算并扣除credits
  const inputTokens = result.usage?.prompt_tokens || 0;
  const outputTokens = result.usage?.completion_tokens || 0;
  const cost = calculateLLMCost(modelInfo, inputTokens, outputTokens);
  if (cost > 0) {
    await deductCredits(orgId, cost);
  }

  return result;
});
