import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { decryptTextWithPrivateKey } from '@/lib/server/crypto';
import { LLMClient } from '@repo/llm/chat';
import fs from 'fs';
import path from 'path';
import { withUserAuthApi } from '@/lib/server/auth-wrapper';

const privateKey = fs.readFileSync(path.join(process.cwd(), 'keys', 'private.pem'), 'utf8');

// 获取AI流式响应
async function getAIResponse({ organizationId, sessionId, messageId }: { organizationId: string; sessionId: string; messageId: string }) {
  try {
    // 获取会话和消息历史
    const session = await prisma.chatSessions.findUnique({
      where: {
        id: sessionId,
        organizationId,
      },
      include: {
        messages: {
          where: {
            isComplete: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // 获取模型提供商配置
    const providerConfig = await prisma.modelProviderConfigs.findFirst({
      where: {
        provider: session.modelProvider,
        organizationId,
      },
    });

    if (!providerConfig) {
      throw new Error('Model provider config not found');
    }

    const config = JSON.parse(decryptTextWithPrivateKey(providerConfig.config, privateKey));

    // 创建LLM客户端
    const llmClient = new LLMClient({
      providerId: session.modelProvider,
      modelId: session.modelId,
      ...config,
    });

    // 构建消息历史
    const messages = session.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));

    // 返回流式响应生成器
    return {
      sessionId,
      messageId,
      streamGenerator: async function* () {
        try {
          let fullContent = '';

          const stream = await llmClient.chatStream({
            messages,
          });

          for await (const chunk of stream) {
            if (chunk.choices && chunk.choices[0]?.delta?.content) {
              const content = chunk.choices[0].delta.content;
              fullContent += content;

              // 更新数据库中的消息内容
              await prisma.chatMessages.update({
                where: { id: messageId },
                data: {
                  content: fullContent,
                  isStreaming: true,
                },
              });

              yield {
                type: 'content',
                content,
                fullContent,
              };
            }

            if (chunk.choices && chunk.choices[0]?.finish_reason) {
              // 流式响应完成
              await prisma.chatMessages.update({
                where: { id: messageId },
                data: {
                  content: fullContent,
                  isStreaming: false,
                  isComplete: true,
                  finishReason: chunk.choices[0].finish_reason,
                },
              });

              yield {
                type: 'finished',
                finishReason: chunk.choices[0].finish_reason,
                fullContent,
              };
              break;
            }
          }
        } catch (error) {
          // 发生错误时更新消息状态
          await prisma.chatMessages.update({
            where: { id: messageId },
            data: {
              isStreaming: false,
              isComplete: true,
              content: 'Error: ' + (error as Error).message,
            },
          });

          yield {
            type: 'error',
            error: (error as Error).message,
          };
        }
      },
    };
  } catch (error) {
    console.error('Error getting AI response:', error);
    throw error;
  }
}

export const POST = withUserAuthApi<{}, {}, { sessionId: string; messageId: string }>(async (_req, ctx) => {
  try {
    const { sessionId, messageId } = ctx.body;

    if (!sessionId || !messageId) {
      return new NextResponse('Missing required parameters', { status: 400 });
    }

    // 获取AI响应流
    const result = await getAIResponse({
      organizationId: ctx.orgId,
      sessionId,
      messageId,
    });

    // 创建SSE流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let heartbeatInterval: NodeJS.Timeout | null = null;

        // 启动心跳机制
        const startHeartbeat = () => {
          heartbeatInterval = setInterval(() => {
            try {
              const heartbeatData = `data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`;
              controller.enqueue(encoder.encode(heartbeatData));
            } catch (error) {
              console.error('Heartbeat error:', error);
              if (heartbeatInterval) clearInterval(heartbeatInterval);
            }
          }, 30000); // 30秒心跳间隔
        };

        const stopHeartbeat = () => {
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
        };

        try {
          startHeartbeat();
          const generator = result.streamGenerator();

          for await (const chunk of generator) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }

          stopHeartbeat();
          // 发送结束信号
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          stopHeartbeat();
          console.error('Stream error:', error);
          const errorData = `data: ${JSON.stringify({ type: 'error', error: (error as Error).message })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
