/**
 * FlowCanvas Agent 流式聊天 API
 * 专门用于 FlowCanvas 项目的 Agent 会话
 */

import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import CHAT, { UnifiedChat } from '@repo/llm/chat';
import { NextResponse } from 'next/server';
import { getAgent } from '@/agents/server';

/**
 * 异步生成会话标题
 * 根据用户的第一条消息，使用 AI 生成简洁的标题
 * @returns 生成的标题，用于通过 SSE 通知前端
 */
async function generateSessionTitle(sessionId: string, userMessage: string, organizationId: string): Promise<string> {
  try {
    // 使用快速模型生成标题
    const llmClient = CHAT.createClient('claude-3-5-sonnet');
    
    const response = await llmClient.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个标题生成助手。根据用户的消息，生成一个简洁的会话标题（5-8个字），直接返回标题文本，不要有任何其他内容。',
        },
        {
          role: 'user',
          content: `用户消息：${userMessage}\n\n请为这个会话生成一个简洁的标题（5-8个字）：`,
        },
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    const messageContent = response.choices[0]?.message?.content;
    const title = (typeof messageContent === 'string' ? messageContent.trim() : '') || userMessage.substring(0, 30);

    // 更新会话标题
    await prisma.flowCanvasProjectAgentSessions.update({
      where: { id: sessionId, organizationId },
      data: { title },
    });

    console.log(`[FlowCanvas Agent] Generated title for session ${sessionId}: ${title}`);
    return title;
  } catch (error) {
    console.error('[FlowCanvas Agent] Failed to generate title:', error);
    // 如果失败，使用简单截取
    const fallbackTitle = userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage;
    await prisma.flowCanvasProjectAgentSessions.update({
      where: { id: sessionId, organizationId },
      data: { title: fallbackTitle },
    }).catch(err => console.error('[FlowCanvas Agent] Failed to set fallback title:', err));
    return fallbackTitle;
  }
}

// 获取AI流式响应
async function getAIResponse({ organizationId, sessionId, content }: { organizationId: string; sessionId: string; content: string }) {
  try {
    // 获取会话和消息历史
    const session = await prisma.flowCanvasProjectAgentSessions.findUnique({
      where: {
        id: sessionId,
        organizationId,
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

    // 检查是否需要生成标题（在创建新消息之前判断）
    // 如果是第一条消息，且标题为空或者是默认标题 "New Chat"，则生成新标题
    const shouldGenerateTitle = session.messages.length === 0 && (!session.title || session.title === 'New Chat');
    console.log(`[FlowCanvas Stream] Session has ${session.messages.length} messages, title: ${session.title}, shouldGenerateTitle: ${shouldGenerateTitle}`);

    // 加载Agent配置（系统提示词和工具）
    // 优先使用session关联的agentId，如果没有则使用默认的 Coordinator
    let agentConfig;
    try {
      agentConfig = getAgent(session.agentId || undefined);
    } catch (agentError) {
      console.error('Error loading agent config:', agentError);
      throw new Error(`Failed to load agent: ${agentError instanceof Error ? agentError.message : 'Unknown error'}`);
    }

    // 创建用户消息记录
    const userMessage = await prisma.flowCanvasProjectAgentMessages.create({
      data: {
        sessionId,
        organizationId,
        role: 'user',
        content,
        isComplete: true,
      },
    });

    // 创建AI消息记录（初始为空，用于流式更新）
    const aiMessage = await prisma.flowCanvasProjectAgentMessages.create({
      data: {
        sessionId,
        organizationId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        isComplete: false,
      },
    });

    // 更新会话的最后更新时间
    await prisma.flowCanvasProjectAgentSessions.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    // 创建LLM客户端
    const llmClient = CHAT.createClient(session.modelId);

    // 构建消息历史（包括新的用户消息）
    const messages: UnifiedChat.Message[] = [
      { role: 'system' as const, content: agentConfig.systemPrompt },
      ...session.messages
        .filter(msg => {
          // 如果是 assistant 消息且有 toolCalls，即使 isComplete=false 也要保留
          if (msg.role === 'assistant' && msg.toolCalls) return true;
          // 如果是 tool 消息，检查是否完成
          if (msg.role === 'tool') return msg.isComplete;
          // 其他消息只保留完成的
          return msg.isComplete && !msg.isStreaming;
        })
        .map(msg => {
          const baseMsg: any = {
            role: msg.role as UnifiedChat.Message['role'],
            content: msg.content,
          };

          // 如果是 assistant 消息且有 toolCalls，包含 toolCalls
          if (msg.role === 'assistant' && msg.toolCalls) {
            baseMsg.tool_calls = msg.toolCalls;
          }

          // 如果是 tool 消息，包含 tool_call_id
          if (msg.role === 'tool' && msg.toolCallId) {
            baseMsg.tool_call_id = msg.toolCallId;
          }

          return baseMsg;
        }),
      { role: 'user', content },
    ];

    // 调试：打印消息结构
    console.log('[FlowCanvas Stream] Messages structure:');
    messages.forEach((msg, idx) => {
      if (msg.role === 'assistant' && msg.tool_calls) {
        console.log(
          `  [${idx}] assistant with ${msg.tool_calls.length} tool_calls:`,
          msg.tool_calls.map((tc: any) => ({ id: tc.id, name: tc.function.name })),
        );
      } else if (msg.role === 'tool') {
        console.log(`  [${idx}] tool result for tool_call_id: ${msg.tool_call_id}`);
      } else {
        console.log(`  [${idx}] ${msg.role}: ${typeof msg.content === 'string' ? msg.content.substring(0, 50) : '[complex]'}`);
      }
    });

    // 返回流式响应生成器
    return {
      sessionId,
      userMessageId: userMessage.id,
      aiMessageId: aiMessage.id,
      shouldGenerateTitle,
      streamGenerator: async function* () {
        try {
          let fullContent = '';

          // 构建聊天参数，包含工具配置
          const chatParams: UnifiedChat.ChatCompletionParams = {
            messages,
            ...(agentConfig.tools.length > 0 && {
              tools: agentConfig.tools,
              tool_choice: 'auto' as const,
            }),
          };

          console.log(`[FlowCanvas Stream] Agent: ${agentConfig.id}, Tools count: ${agentConfig.tools.length}`);

          const stream = llmClient.chatStream(chatParams);

          let toolCalls: any[] = [];

          for await (const chunk of stream) {
            const choice = chunk.choices?.[0];
            if (!choice) continue;

            // 处理文本内容
            if (choice.delta?.content) {
              const contentDelta = choice.delta.content;
              fullContent += contentDelta;

              // 更新数据库中的消息内容
              await prisma.flowCanvasProjectAgentMessages.update({
                where: { id: aiMessage.id },
                data: {
                  content: fullContent,
                  isStreaming: true,
                },
              });

              yield {
                type: 'content',
                content: contentDelta,
                fullContent,
              };
            }

            // 处理工具调用
            if (choice.delta?.tool_calls) {
              // 累积tool_calls（流式返回可能分多次）
              for (const toolCall of choice.delta.tool_calls) {
                const index = (toolCall as any).index ?? 0;
                if (!toolCalls[index]) {
                  toolCalls[index] = {
                    id: (toolCall as any).id || `tool_${index}`,
                    type: (toolCall as any).type || 'function',
                    function: {
                      name: (toolCall as any).function?.name || '',
                      arguments: (toolCall as any).function?.arguments || '',
                    },
                  };
                } else {
                  // 累加 name（某些 provider 可能分多次发送）
                  if ((toolCall as any).function?.name) {
                    toolCalls[index].function.name = (toolCall as any).function.name;
                  }
                  // 累加 arguments
                  if ((toolCall as any).function?.arguments) {
                    toolCalls[index].function.arguments += (toolCall as any).function.arguments;
                  }
                }
              }
            }

            // 处理结束
            if (choice.finish_reason) {
              // 如果有工具调用，发送给前端
              if (choice.finish_reason === 'tool_calls' && toolCalls.length > 0) {
                // 验证 tool calls 的完整性
                const validToolCalls = toolCalls.filter(tc => tc).map(tc => {
                  // 验证 JSON 是否完整
                  if (tc.function?.arguments) {
                    try {
                      JSON.parse(tc.function.arguments);
                    } catch (error) {
                      console.error(`[FlowCanvas Stream] Warning: Tool ${tc.function.name} has invalid JSON arguments:`, tc.function.arguments);
                    }
                  }
                  return tc;
                });

                await prisma.flowCanvasProjectAgentMessages.update({
                  where: { id: aiMessage.id },
                  data: {
                    content: fullContent,
                    isStreaming: false,
                    isComplete: false, // 等待工具执行结果
                    finishReason: 'tool_calls',
                    toolCalls: validToolCalls,
                  },
                });

                yield {
                  type: 'tool_calls',
                  toolCalls: validToolCalls,
                  fullContent,
                };
              } else {
                // 正常结束
                await prisma.flowCanvasProjectAgentMessages.update({
                  where: { id: aiMessage.id },
                  data: {
                    content: fullContent,
                    isStreaming: false,
                    isComplete: true,
                    finishReason: choice.finish_reason,
                  },
                });

                yield {
                  type: 'finished',
                  finishReason: choice.finish_reason,
                  fullContent,
                };
              }
              break;
            }
          }
        } catch (error) {
          // 发生错误时更新消息状态
          await prisma.flowCanvasProjectAgentMessages.update({
            where: { id: aiMessage.id },
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

export const POST = withUserAuthApi<{}, {}, { sessionId: string; content: string }>(async (_req, ctx) => {
  try {
    const { sessionId, content } = ctx.body;

    if (!sessionId || !content) {
      return new NextResponse('Missing required parameters', { status: 400 });
    }

    // 获取AI响应流
    const result = await getAIResponse({
      organizationId: ctx.orgId,
      sessionId,
      content,
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

          // 首先发送消息ID，让前端知道新创建的消息ID
          const initData = `data: ${JSON.stringify({
            type: 'init',
            userMessageId: result.userMessageId,
            aiMessageId: result.aiMessageId,
          })}\n\n`;
          controller.enqueue(encoder.encode(initData));

          const generator = result.streamGenerator();

          for await (const chunk of generator) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }

          // 如果需要生成标题，等待标题生成完成后再关闭流
          if (result.shouldGenerateTitle) {
            console.log(`[FlowCanvas Stream] Generating title for new session ${sessionId}...`);
            try {
              const title = await generateSessionTitle(sessionId, content, ctx.orgId);
              console.log(`[FlowCanvas Stream] Title generated: ${title}`);
              const titleData = `data: ${JSON.stringify({ type: 'title_updated', title })}\n\n`;
              controller.enqueue(encoder.encode(titleData));
              console.log(`[FlowCanvas Stream] Title update sent to client`);
            } catch (err) {
              console.error('[FlowCanvas Stream] Failed to generate title:', err);
            }
          } else {
            console.log(`[FlowCanvas Stream] Skip title generation (shouldGenerateTitle: ${result.shouldGenerateTitle})`);
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
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
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

