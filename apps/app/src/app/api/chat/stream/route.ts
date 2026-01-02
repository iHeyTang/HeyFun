import { loadModelDefinitionsFromDatabase } from '@/actions/llm';
import { getAgent } from '@/agents';
import { buildSystemPrompt } from '@/agents/core/system-prompt';
import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { calculateLLMCost, checkCreditsBalance, deductCredits } from '@/lib/server/credit';
import { recordGatewayUsage } from '@/lib/server/gateway';
import { prisma } from '@/lib/server/prisma';
import { queue } from '@/lib/server/queue';
import CHAT, { UnifiedChat } from '@repo/llm/chat';
import { NextResponse } from 'next/server';

// 获取AI流式响应
async function getAIResponse({
  organizationId,
  sessionId,
  content,
  modelId,
  requestStartTime,
  ipAddress,
}: {
  organizationId: string;
  sessionId: string;
  content: string;
  modelId: string;
  requestStartTime?: number;
  ipAddress?: string;
}) {
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

    // 检查是否需要生成标题（在创建新消息之前判断）
    // 如果是第一条消息，且标题为空或者是默认标题 "New Chat"，则生成新标题
    const shouldGenerateTitle = session.messages.length === 0 && (!session.title || session.title === 'New Chat');
    console.log(`[Stream] Session has ${session.messages.length} messages, title: ${session.title}, shouldGenerateTitle: ${shouldGenerateTitle}`);

    // 并行执行独立操作以提升性能
    const [agentConfig, allModels, userMessage, aiMessage] = await Promise.all([
      // 加载Agent配置（系统提示词和工具）
      (async () => {
        try {
          return getAgent(session.agentId || undefined);
        } catch (agentError) {
          console.error('Error loading agent config:', agentError);
          throw new Error(`Failed to load agent: ${agentError instanceof Error ? agentError.message : 'Unknown error'}`);
        }
      })(),
      // 加载模型定义
      loadModelDefinitionsFromDatabase(),
      // 创建用户消息记录
      prisma.chatMessages.create({
        data: {
          sessionId,
          organizationId,
          role: 'user',
          content,
          isComplete: true,
        },
      }),
      // 创建AI消息记录（初始为空，用于流式更新）
      prisma.chatMessages.create({
        data: {
          sessionId,
          organizationId,
          role: 'assistant',
          content: '',
          isStreaming: true,
          isComplete: false,
          modelId,
        },
      }),
    ]);

    // 异步更新会话的最后更新时间（不阻塞流式响应）
    prisma.chatSessions
      .update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      })
      .catch(err => console.error('[Stream] Failed to update session timestamp:', err));

    const modelInfo = allModels.find(m => m.id === modelId);
    if (!modelInfo) {
      throw new Error(`Model ${modelId} not found`);
    }

    // 设置模型列表到 CHAT 实例
    CHAT.setModels(allModels);

    // 创建LLM客户端
    const llmClient = CHAT.createClient(modelId);

    // 构建消息历史（包括新的用户消息）
    const systemPrompt = buildSystemPrompt({ preset: agentConfig.promptBlocks, framework: [], dynamic: [] });
    const messages: UnifiedChat.Message[] = [{ role: 'system' as const, content: systemPrompt }];

    // 按顺序处理消息，确保工具调用和工具结果配对
    for (const msg of session.messages) {
      if (msg.role === 'assistant' && msg.toolCalls) {
        // 对于有 toolCalls 的 assistant 消息，从 toolResults 读取工具结果
        const toolCalls = msg.toolCalls;
        const toolResults = msg.toolResults || [];
        const toolCallIds = toolCalls.map(tc => tc.id);

        // 只有当工具结果数量等于工具调用数量时，才添加这条消息
        if (toolResults.length === toolCallIds.length) {
          const baseMsg: UnifiedChat.Message = {
            role: 'assistant' as const,
            content: msg.content,
            tool_calls: toolCalls,
          };
          messages.push(baseMsg);

          // 添加对应的 tool 消息（从 toolResults 构建）
          for (const toolCallId of toolCallIds) {
            const toolResult = toolResults.find(tr => tr.toolCallId === toolCallId);
            if (toolResult) {
              // 从 toolResult 中提取内容，序列化整个对象
              const toolContent = JSON.stringify(toolResult);
              messages.push({
                role: 'tool' as const,
                content: toolContent,
                tool_call_id: toolCallId,
              });
            }
          }
        }
      } else if (msg.role === 'user' || msg.role === 'system') {
        // 普通消息直接添加
        messages.push({
          role: msg.role as 'user' | 'system',
          content: msg.content,
        });
      }
      // 跳过 role='tool' 的消息，因为它们已经作为 toolResults 处理了
    }

    // 添加新的用户消息
    messages.push({ role: 'user', content });

    // 调试：打印消息结构
    console.log('[Stream] Messages structure:');
    messages.forEach((msg, idx) => {
      if (msg.role === 'assistant' && msg.tool_calls) {
        console.log(
          `  [${idx}] assistant with ${msg.tool_calls.length} tool_calls:`,
          msg.tool_calls.map((tc: any) => ({ id: tc.id, name: tc.function.name })),
        );
      } else if (msg.role === 'tool') {
        console.log(`  [${idx}] tool result for tool_call_id: ${msg.tool_call_id}`);
      } else if (msg.role === 'user' || msg.role === 'system') {
        console.log(`  [${idx}] ${msg.role}: ${typeof msg.content === 'string' ? msg.content.substring(0, 50) : '[complex]'}`);
      }
    });

    // 返回流式响应生成器
    return {
      sessionId,
      userMessageId: userMessage.id,
      aiMessageId: aiMessage.id,
      shouldGenerateTitle,
      modelInfo,
      streamGenerator: async function* () {
        let fullContent = '';
        let inputTokens = 0;
        let outputTokens = 0;
        try {
          // 构建聊天参数，包含工具配置
          const chatParams: UnifiedChat.ChatCompletionParams = {
            messages,
            ...(agentConfig.tools.length > 0 && {
              tools: agentConfig.tools,
              tool_choice: 'auto' as const,
            }),
          };

          // 调试：打印工具配置
          console.log(`[Stream] Agent: ${agentConfig.id}, Tools count: ${agentConfig.tools.length}`);
          if (agentConfig.tools.length > 0) {
            console.log(
              `[Stream] Tools:`,
              JSON.stringify(
                agentConfig.tools.map(t => ({
                  type: t.type,
                  name: t.function.name,
                  hasParams: !!t.function.parameters,
                })),
                null,
                2,
              ),
            );
          }

          // 在开始前检查余额（估算）
          const estimatedOutputTokens = 1000;
          const estimatedCost = calculateLLMCost(modelInfo, 0, estimatedOutputTokens);
          const hasBalance = await checkCreditsBalance(organizationId, estimatedCost);
          if (!hasBalance) {
            yield {
              type: 'error',
              error: 'Insufficient credits balance',
            };
            return;
          }

          const stream = llmClient.chatStream(chatParams);

          const toolCalls: any[] = [];

          let finishReason: string | null = null;
          let validToolCalls: any[] = [];

          for await (const chunk of stream) {
            // 累积token使用量
            if (chunk.usage) {
              inputTokens += chunk.usage.prompt_tokens || 0;
              outputTokens += chunk.usage.completion_tokens || 0;
            }
            const choice = chunk.choices?.[0];
            if (!choice) continue;

            // 处理文本内容
            if (choice.delta?.content) {
              const contentDelta = choice.delta.content;
              fullContent += contentDelta;

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
                const toolCallWithIndex = toolCall as UnifiedChat.ToolCall & { index?: number };
                const index = toolCallWithIndex.index ?? 0;
                if (!toolCalls[index]) {
                  toolCalls[index] = {
                    id: toolCallWithIndex.id || `tool_${index}`,
                    type: toolCallWithIndex.type || 'function',
                    function: {
                      name: toolCallWithIndex.function?.name || '',
                      arguments: toolCallWithIndex.function?.arguments || '',
                    },
                  };
                } else {
                  // 累加 name（某些 provider 可能分多次发送）
                  if (toolCallWithIndex.function?.name) {
                    toolCalls[index].function.name = toolCallWithIndex.function.name;
                  }
                  // 累加 arguments
                  if (toolCallWithIndex.function?.arguments) {
                    toolCalls[index].function.arguments += toolCallWithIndex.function.arguments;
                  }
                }
              }
            }

            // 处理结束
            if (choice.finish_reason) {
              finishReason = choice.finish_reason;

              // 如果有工具调用，发送给前端
              if (choice.finish_reason === 'tool_calls' && toolCalls.length > 0) {
                // 验证 tool calls 的完整性
                validToolCalls = toolCalls
                  .filter(tc => tc)
                  .map(tc => {
                    // 验证 JSON 是否完整
                    if (tc.function?.arguments) {
                      try {
                        JSON.parse(tc.function.arguments);
                      } catch (error) {
                        console.error(`[Stream] Warning: Tool ${tc.function.name} has invalid JSON arguments:`, tc.function.arguments);
                        console.error(`[Stream] Error:`, (error as Error).message);
                      }
                    }
                    return tc;
                  });

                yield {
                  type: 'tool_calls',
                  toolCalls: validToolCalls,
                  fullContent,
                };
              } else {
                // 正常结束
                yield {
                  type: 'finished',
                  finishReason: choice.finish_reason,
                  fullContent,
                };
              }
              break;
            }
          }

          // 流式响应完成后，统一更新数据库
          if (finishReason) {
            if (finishReason === 'tool_calls' && validToolCalls.length > 0) {
              await prisma.chatMessages.update({
                where: { id: aiMessage.id },
                data: {
                  content: fullContent,
                  isStreaming: false,
                  isComplete: false, // 等待工具执行结果
                  finishReason: 'tool_calls',
                  toolCalls: validToolCalls,
                },
              });
            } else {
              await prisma.chatMessages.update({
                where: { id: aiMessage.id },
                data: {
                  content: fullContent,
                  isStreaming: false,
                  isComplete: true,
                  finishReason: finishReason,
                },
              });
            }
          }

          // 流式响应完成后，计算并扣除credits
          const cost = calculateLLMCost(modelInfo, inputTokens, outputTokens);
          if (cost > 0) {
            try {
              await deductCredits(organizationId, cost);
              console.log(`[Stream] Deducted ${cost} credits for session ${sessionId} (${inputTokens} input + ${outputTokens} output tokens)`);
            } catch (error) {
              console.error(`[Stream] Failed to deduct credits for session ${sessionId}:`, error);
              // 注意：这里不抛出错误，因为响应已经发送给客户端了
            }
          }

          // 记录 gateway 使用量
          try {
            await recordGatewayUsage({
              organizationId,
              apiKeyId: null, // Clerk 鉴权模式
              modelId: modelInfo.id,
              endpoint: '/api/chat/stream',
              method: 'POST',
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
              statusCode: 200,
              responseTime: requestStartTime ? Date.now() - requestStartTime : undefined,
              ipAddress,
            });
          } catch (error) {
            console.error(`[Stream] Failed to record gateway usage for session ${sessionId}:`, error);
            // 不抛出错误，避免影响主流程
          }
        } catch (error) {
          // 发生错误时更新消息状态
          await prisma.chatMessages.update({
            where: { id: aiMessage.id },
            data: {
              isStreaming: false,
              isComplete: true,
              content: 'Error: ' + (error as Error).message,
            },
          });

          // 记录错误使用量
          try {
            await recordGatewayUsage({
              organizationId,
              apiKeyId: null, // Clerk 鉴权模式
              modelId: modelInfo.id,
              endpoint: '/api/chat/stream',
              method: 'POST',
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
              statusCode: 500,
              responseTime: requestStartTime ? Date.now() - requestStartTime : undefined,
              errorMessage: (error as Error).message,
              ipAddress,
            });
          } catch (recordError) {
            console.error(`[Stream] Failed to record gateway usage error for session ${sessionId}:`, recordError);
          }

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

export const POST = withUserAuthApi<{}, {}, { sessionId: string; content: string; modelId: string }>(async (req, ctx) => {
  const requestStartTime = Date.now();
  try {
    const { sessionId, content, modelId } = ctx.body;

    if (!sessionId || !content) {
      return new NextResponse('Missing required parameters', { status: 400 });
    }

    // 获取 IP 地址
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;

    // 获取AI响应流
    const result = await getAIResponse({
      organizationId: ctx.orgId,
      sessionId,
      content,
      modelId,
      requestStartTime,
      ipAddress,
    });

    // 通过队列异步生成标题，不阻塞流的关闭
    if (result.shouldGenerateTitle) {
      console.log(`[Stream] Queuing title generation for new session ${sessionId}...`);
      // 异步调用队列，不等待完成
      queue.publish({ url: '/api/queue/summary', body: { sessionId, userMessage: content, organizationId: ctx.orgId } }).catch((err: unknown) => {
        console.error('[Stream] Failed to queue title generation:', err);
      });
    }

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
