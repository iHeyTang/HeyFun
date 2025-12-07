'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import type { ModelInfo } from '@repo/llm/chat';

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

// 获取模型列表（从数据库加载）
export const getAvailableModels = withUserAuth(async () => {
  try {
    // 从数据库加载所有模型定义
    const definitions = await prisma.systemModelDefinitions.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const models: ModelInfo[] = definitions.map(def => ({
      id: def.modelId,
      name: def.name,
      provider: def.provider,
      family: def.family,
      type: (def.type as 'language' | 'embedding' | 'image') || undefined,
      description: def.description || undefined,
      contextLength: def.contextLength || undefined,
      supportsStreaming: def.supportsStreaming,
      supportsFunctionCalling: def.supportsFunctionCalling,
      supportsVision: def.supportsVision,
      pricing: def.pricing as ModelInfo['pricing'] | undefined,
      enabled: def.enabled,
      metadata: (def.metadata as Record<string, any>) || undefined,
    }));

    return models;
  } catch (error) {
    console.error('Error getting available models:', error);
    throw error;
  }
});
