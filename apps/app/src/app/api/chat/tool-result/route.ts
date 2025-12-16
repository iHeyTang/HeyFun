/**
 * 工具执行结果 API
 * 接收前端执行的工具结果并保存到数据库
 */

import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { workflow } from '@/lib/server/workflow';
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
    const session = await prisma.chatSessions.findUnique({
      where: {
        id: sessionId,
        organizationId: ctx.orgId,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 获取包含工具调用的消息
    const messageWithTools = await prisma.chatMessages.findUnique({
      where: {
        id: messageId,
        organizationId: ctx.orgId,
      },
    });

    if (!messageWithTools) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // 获取现有的toolCalls和toolResults
    const existingToolCalls = messageWithTools.toolCalls || [];
    const existingToolResults = messageWithTools.toolResults || [];

    // 构建新的toolResults数组
    const newToolResults = [...existingToolResults];

    // 为每个工具结果找到对应的toolCall并添加到toolResults
    for (const toolResult of toolResults) {
      const toolCall = existingToolCalls.find(tc => tc.id === toolResult.toolCallId);
      if (toolCall) {
        // 检查是否已经存在该toolCallId的结果
        const existingResultIndex = newToolResults.findIndex(tr => tr.toolCallId === toolResult.toolCallId);
        const resultData: PrismaJson.ToolResult = {
          toolCallId: toolResult.toolCallId,
          toolName: toolCall.function.name,
          success: toolResult.result.success ?? true,
          data: toolResult.result.data,
          error: toolResult.result.error,
          message: toolResult.result.message,
        };

        if (existingResultIndex >= 0) {
          // 更新已存在的结果
          newToolResults[existingResultIndex] = resultData;
        } else {
          // 添加新结果
          newToolResults.push(resultData);
        }
      }
    }

    // 更新assistant消息的toolResults字段，并标记为已完成
    await prisma.chatMessages.update({
      where: { id: messageWithTools.id },
      data: {
        toolResults: newToolResults,
        isComplete: true,
      },
    });

    // 触发 workflow 事件，让 workflow 继续执行
    // 从消息的 finishReason 字段中获取 workflow run ID 和 event name
    if (messageWithTools.finishReason) {
      try {
        const metadata = JSON.parse(messageWithTools.finishReason);
        if (metadata.eventName) {
          await workflow.notify(metadata.eventName, {
            messageId: messageWithTools.id,
            toolResults: newToolResults.map(tr => ({
              toolCallId: tr.toolCallId,
            })),
          });
        }
      } catch (error) {
        console.error('[Tool Result] Failed to parse workflow metadata or trigger event:', error);
        // 如果解析失败，不影响工具结果的保存
      }
    }

    // 返回成功响应
    return NextResponse.json({
      success: true,
      messageId: messageWithTools.id,
      toolResults: newToolResults,
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
