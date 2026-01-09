/**
 * Agent Messages API
 * 获取会话消息列表，支持游标分页
 */

import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { NextResponse } from 'next/server';

export const GET = withUserAuthApi<{}, { sessionId: string; cursor?: string; limit?: string }, {}>(async (_req, ctx) => {
  try {
    const { sessionId, cursor, limit } = ctx.query;

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 });
    }

    // 验证会话归属
    const session = await prisma.chatSessions.findUnique({
      where: {
        id: sessionId,
        organizationId: ctx.orgId,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const limitNum = limit ? parseInt(limit, 10) : 50;
    const take = Math.min(Math.max(limitNum, 1), 100); // 限制在 1-100 之间

    // 构建查询条件
    const where: any = {
      sessionId,
      organizationId: ctx.orgId,
    };

    // 如果有游标，从该消息之后开始查询
    if (cursor) {
      const cursorMessage = await prisma.chatMessages.findUnique({
        where: { id: cursor },
      });
      if (cursorMessage) {
        where.createdAt = {
          gt: cursorMessage.createdAt,
        };
      }
    }

    // 查询消息
    const messages = await prisma.chatMessages.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take,
    });

    // 获取下一条游标（如果还有更多消息）
    let nextCursor: string | null = null;
    if (messages.length === take) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        const hasMore = await prisma.chatMessages.count({
          where: {
            sessionId,
            organizationId: ctx.orgId,
            createdAt: {
              gt: lastMessage.createdAt,
            },
          },
        });
        if (hasMore > 0) {
          nextCursor = lastMessage.id;
        }
      }
    }

    return NextResponse.json({
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        isStreaming: msg.isStreaming,
        isComplete: msg.isComplete,
        createdAt: msg.createdAt,
        toolCalls: msg.toolCalls,
        toolResults: msg.toolResults,
        finishReason: msg.finishReason,
        modelId: msg.modelId,
        tokenCount: msg.tokenCount,
        inputTokens: msg.inputTokens,
        outputTokens: msg.outputTokens,
        cachedInputTokens: msg.cachedInputTokens,
        cachedOutputTokens: msg.cachedOutputTokens,
        metadata: msg.metadata,
      })),
      nextCursor,
      hasMore: nextCursor !== null,
      status: session.status, // 返回处理状态
      title: session.title, // 返回会话标题
    });
  } catch (error) {
    console.error('Messages API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});
