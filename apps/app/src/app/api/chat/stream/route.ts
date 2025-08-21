import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { headers } from 'next/headers';
import { decryptTextWithPrivateKey } from '@/lib/server/crypto';
import { LLMClient } from '@repo/llm/chat';
import fs from 'fs';
import path from 'path';

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

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { sessionId, messageId } = body;

    if (!sessionId || !messageId) {
      return new NextResponse('Missing required parameters', { status: 400 });
    }

    // 获取用户组织信息
    const orgUser = await prisma.organizationUsers.findFirst({
      where: { userId: session.user.id },
    });

    if (!orgUser) {
      return new NextResponse('Organization not found', { status: 404 });
    }

    // 获取AI响应流
    const result = await getAIResponse({
      organizationId: orgUser.organizationId,
      sessionId,
      messageId,
    });

    // 创建SSE流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = result.streamGenerator();

          for await (const chunk of generator) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }

          // 发送结束信号
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
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
}

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
