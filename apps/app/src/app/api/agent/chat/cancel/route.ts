/**
 * Agent Chat Cancel API
 * 中断正在执行的会话
 */

import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { NextResponse } from 'next/server';

export const POST = withUserAuthApi<{}, {}, { sessionId: string }>(async (_req, ctx) => {
  try {
    const { sessionId } = ctx.body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 });
    }

    // 获取会话信息
    const session = await prisma.chatSessions.findUnique({
      where: {
        id: sessionId,
        organizationId: ctx.orgId,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 检查会话是否已删除
    if (session.deletedAt) {
      return NextResponse.json({ error: 'Session is deleted' }, { status: 410 });
    }

    // 检查当前处理状态，只有正在处理中的会话才能中断
    if (session.status !== 'pending' && session.status !== 'processing') {
      return NextResponse.json({ error: `Session is ${session.status}, cannot cancel` }, { status: 400 });
    }

    // 更新会话状态为 cancelling，标记为中断中
    // workflow 会在合适的位置检查这个标志位并结束 workflow
    await prisma.chatSessions.update({
      where: { id: sessionId },
      data: {
        status: 'cancelling', // 设置为 cancelling，workflow 会在下次检查时发现并停止
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Session cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel chat API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});
