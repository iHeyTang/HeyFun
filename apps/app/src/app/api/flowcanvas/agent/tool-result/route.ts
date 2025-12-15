/**
 * FlowCanvas Agent 工具执行结果 API
 * 接收前端执行的工具结果并保存到数据库
 */

import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { NextResponse } from 'next/server';

interface ToolResultRequest {
  sessionId: string;
  messageId: string;
  toolResults: Array<{
    toolCallId: string;
    result: any;
  }>;
}

export const POST = withUserAuthApi<{}, {}, ToolResultRequest>(async (_req, ctx) => {
  try {
    const { sessionId, messageId, toolResults } = ctx.body;

    if (!sessionId || !messageId || !toolResults) {
      return new NextResponse('Missing required parameters', { status: 400 });
    }

    // 验证会话存在
    const session = await prisma.flowCanvasProjectAgentSessions.findUnique({
      where: {
        id: sessionId,
        organizationId: ctx.orgId,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 获取包含工具调用的消息
    const messageWithTools = await prisma.flowCanvasProjectAgentMessages.findUnique({
      where: {
        id: messageId,
        organizationId: ctx.orgId,
      },
    });

    if (!messageWithTools) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // 标记原始的工具调用消息为已完成
    await prisma.flowCanvasProjectAgentMessages.update({
      where: { id: messageWithTools.id },
      data: { isComplete: true },
    });

    // 保存工具结果消息到数据库
    const savedToolMessages = [];
    for (const toolResult of toolResults) {
      // 先检查是否已经存在相同的工具结果
      const existingToolMessage = await prisma.flowCanvasProjectAgentMessages.findFirst({
        where: {
          sessionId,
          organizationId: ctx.orgId,
          role: 'tool',
          toolCallId: toolResult.toolCallId,
        },
      });

      if (!existingToolMessage) {
        const toolMessage = await prisma.flowCanvasProjectAgentMessages.create({
          data: {
            sessionId,
            organizationId: ctx.orgId,
            role: 'tool',
            content: JSON.stringify(toolResult.result),
            toolCallId: toolResult.toolCallId,
            isComplete: true,
          },
        });
        savedToolMessages.push(toolMessage);
      } else {
        savedToolMessages.push(existingToolMessage);
      }
    }

    // 返回成功响应
    return NextResponse.json({
      success: true,
      messageId: messageWithTools.id,
      toolMessages: savedToolMessages.map(msg => ({
        id: msg.id,
        toolCallId: msg.toolCallId,
      })),
    });
  } catch (error) {
    console.error('Tool result API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});
