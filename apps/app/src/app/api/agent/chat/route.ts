/**
 * Agent Chat API
 * 接收用户消息，持久化后触发 workflow 自动执行多轮次对话
 */

import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { workflow } from '@/lib/server/workflow';
import { NextResponse } from 'next/server';

interface ChatRequest {
  sessionId: string;
  content: string;
  modelId: string;
}

export const POST = withUserAuthApi<{}, {}, ChatRequest>(async (_req, ctx) => {
  try {
    const { sessionId, content, modelId } = ctx.body;

    if (!sessionId || !content || !modelId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
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

    // 检查当前处理状态，如果正在处理中，不允许新请求
    if (session.status === 'pending' || session.status === 'processing') {
      return NextResponse.json({ error: 'Session is already processing, please wait for the current request to complete' }, { status: 409 });
    }

    // 使用原子操作更新状态：只有当前状态是 idle 时才更新为 pending
    // 这样可以防止竞态条件：如果两个请求几乎同时到达，只有一个能成功更新状态
    const statusUpdateResult = await prisma.chatSessions.updateMany({
      where: {
        id: sessionId,
        organizationId: ctx.orgId,
        status: 'idle', // 只有状态是 idle 时才更新
      },
      data: {
        updatedAt: new Date(),
        status: 'pending',
      },
    });

    // 如果更新失败（0 行被更新），说明状态已被其他请求修改，拒绝请求
    if (statusUpdateResult.count === 0) {
      console.warn(`[Chat API] 会话 ${sessionId} 状态已被其他请求修改，拒绝重复请求`);
      return NextResponse.json({ error: 'Session is already processing, please wait for the current request to complete' }, { status: 409 });
    }

    // 创建用户消息
    const userMessage = await prisma.chatMessages.create({
      data: {
        sessionId,
        organizationId: ctx.orgId,
        role: 'user',
        content,
        isComplete: true,
      },
    });

    try {
      // 触发 workflow 自动执行
      console.log(`[Chat API] 触发 workflow，sessionId: ${sessionId}, userMessageId: ${userMessage.id}`);
      const { workflowRunId } = await workflow.trigger({
        url: '/api/workflow/agent',
        body: {
          organizationId: ctx.orgId,
          sessionId,
          userMessageId: userMessage.id,
          modelId: modelId,
          agentId: session.agentId,
        },
      });
      console.log(`[Chat API] Workflow 触发成功，workflowRunId: ${workflowRunId}, sessionId: ${sessionId}`);

      return NextResponse.json({
        success: true,
        userMessageId: userMessage.id,
        workflowRunId,
      });
    } catch (triggerError) {
      // 如果 workflow.trigger() 失败，需要将状态重置为 idle，避免状态停留在 pending
      console.error('Failed to trigger workflow:', triggerError);
      await prisma.chatSessions.update({
        where: { id: sessionId },
        data: {
          status: 'idle',
          updatedAt: new Date(),
        },
      });
      throw triggerError;
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});
