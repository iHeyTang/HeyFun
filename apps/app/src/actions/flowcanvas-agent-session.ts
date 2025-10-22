'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import CHAT from '@repo/llm/chat';

/**
 * FlowCanvas Project Agent Sessions Actions
 * 管理 FlowCanvas 项目中的 Agent 会话
 */

// 创建 FlowCanvas Agent 会话
export const createFlowCanvasAgentSession = withUserAuth(
  async ({ orgId, args }: AuthWrapperContext<{ projectId: string; modelId: string; title?: string; agentId?: string }>) => {
    const { projectId, modelId, title, agentId } = args;

    try {
      const session = await prisma.flowCanvasProjectAgentSessions.create({
        data: {
          organizationId: orgId,
          projectId,
          modelId,
          title: title || null,
          agentId: agentId || null,
          status: 'active',
        },
      });

      return session;
    } catch (error) {
      console.error('Error creating flowcanvas agent session:', error);
      throw error;
    }
  },
);

// 获取 FlowCanvas 项目的 Agent 会话列表
export const getFlowCanvasAgentSessions = withUserAuth(
  async ({ orgId, args }: AuthWrapperContext<{ projectId: string; page?: number; pageSize?: number }>) => {
    const { projectId, page = 1, pageSize = 20 } = args;

    try {
      const sessions = await prisma.flowCanvasProjectAgentSessions.findMany({
        where: {
          organizationId: orgId,
          projectId,
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

      const total = await prisma.flowCanvasProjectAgentSessions.count({
        where: {
          organizationId: orgId,
          projectId,
          status: 'active',
        },
      });

      return { sessions, total };
    } catch (error) {
      console.error('Error getting flowcanvas agent sessions:', error);
      throw error;
    }
  },
);

// 获取特定 FlowCanvas Agent 会话的详细信息和消息
export const getFlowCanvasAgentSession = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ sessionId: string }>) => {
  const { sessionId } = args;

  try {
    const session = await prisma.flowCanvasProjectAgentSessions.findUnique({
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

    return session;
  } catch (error) {
    console.error('Error getting flowcanvas agent session:', error);
    throw error;
  }
});

// 删除 FlowCanvas Agent 会话
export const deleteFlowCanvasAgentSession = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ sessionId: string }>) => {
  const { sessionId } = args;

  try {
    await prisma.flowCanvasProjectAgentSessions.delete({
      where: {
        id: sessionId,
        organizationId: orgId,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting flowcanvas agent session:', error);
    throw error;
  }
});

// 获取模型列表（从 CHAT 模块）
export const getAvailableModels = withUserAuth(async () => {
  try {
    // 返回所有已注册的模型定义
    const models = CHAT.registry.getAllModels();
    return models;
  } catch (error) {
    console.error('Error getting available models:', error);
    throw error;
  }
});

