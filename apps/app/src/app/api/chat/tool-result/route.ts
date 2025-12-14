/**
 * 工具执行结果 API
 * 接收前端执行的工具结果，继续 Agent 对话
 */

import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import CHAT, { UnifiedChat } from '@repo/llm/chat';
import { NextResponse } from 'next/server';
import { getAgent } from '@/agents';
import { calculateLLMCost, deductCredits, checkCreditsBalance } from '@/lib/server/credit';
import { loadModelDefinitionsFromDatabase } from '@/actions/llm';

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

    // 获取会话和所有消息历史
    // 注意：这里需要获取所有消息，包括 isComplete=false 的 assistant 工具调用消息
    const session = await prisma.chatSessions.findUnique({
      where: {
        id: sessionId,
        organizationId: ctx.orgId,
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

    // 获取包含工具调用的消息
    const messageWithTools = await prisma.chatMessages.findUnique({
      where: {
        id: messageId,
        organizationId: ctx.orgId,
      },
    });

    if (!messageWithTools) {
      throw new Error('Message not found');
    }

    // 获取 Agent 配置
    const agentConfig = getAgent(session.agentId || undefined);

    // 加载模型定义
    const allModels = await loadModelDefinitionsFromDatabase();
    const modelInfo = allModels.find(m => m.id === session.modelId);
    if (!modelInfo) {
      throw new Error(`Model ${session.modelId} not found`);
    }

    // 设置模型列表到 CHAT 实例
    CHAT.setModels(allModels);

    // 创建 LLM 客户端
    const llmClient = CHAT.createClient(session.modelId);

    // 构建消息历史
    // 过滤掉正在流式传输或当前待处理的消息（messageId），以及未完成的消息
    // 但保留有 tool_calls 的 assistant 消息（即使 isComplete=false）
    const filteredMessages = session.messages.filter(msg => {
      // 排除当前正在处理的消息
      if (msg.id === messageId) return false;

      // 如果是 assistant 消息且有 toolCalls，即使 isComplete=false 也要保留
      if (msg.role === 'assistant' && msg.toolCalls) return true;

      // 如果是 tool 消息，检查是否完成
      if (msg.role === 'tool') return msg.isComplete;

      // 其他消息只保留完成的
      return msg.isComplete && !msg.isStreaming;
    });

    const messages: UnifiedChat.Message[] = [
      { role: 'system', content: agentConfig.systemPrompt },
      ...filteredMessages.map(msg => {
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
    ];

    // 添加当前的工具调用消息（如果还未在历史中）
    const alreadyInHistory = filteredMessages.some(msg => msg.id === messageWithTools.id);

    if (messageWithTools.toolCalls && !alreadyInHistory) {
      messages.push({
        role: 'assistant',
        content: messageWithTools.content || '',
        tool_calls: messageWithTools.toolCalls as any,
      } as any);
    }

    // 标记原始的工具调用消息为已完成
    await prisma.chatMessages.update({
      where: { id: messageWithTools.id },
      data: { isComplete: true },
    });

    // 保存工具结果消息到数据库并添加到消息历史
    for (const toolResult of toolResults) {
      // 先检查是否已经存在相同的工具结果
      const existingToolMessage = await prisma.chatMessages.findFirst({
        where: {
          sessionId,
          organizationId: ctx.orgId,
          role: 'tool',
          toolCallId: toolResult.toolCallId,
        },
      });

      if (!existingToolMessage) {
        await prisma.chatMessages.create({
          data: {
            sessionId,
            organizationId: ctx.orgId,
            role: 'tool',
            content: JSON.stringify(toolResult.result),
            toolCallId: toolResult.toolCallId,
            isComplete: true,
          },
        });
      }

      // 添加到消息历史中
      messages.push({
        role: 'tool',
        tool_call_id: toolResult.toolCallId,
        content: JSON.stringify(toolResult.result),
      } as any);
    }

    // 添加 Agent 的 Observation 提示（ReAct 框架的观察阶段，如果配置了）
    if (agentConfig.observationPrompt) {
      messages.push({
        role: 'user',
        content: agentConfig.observationPrompt,
      });
    }

    // 创建新的 AI 响应消息
    const aiMessage = await prisma.chatMessages.create({
      data: {
        sessionId,
        organizationId: ctx.orgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        isComplete: false,
      },
    });

    // 创建 SSE 流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送初始化消息
          const initData = `data: ${JSON.stringify({
            type: 'init',
            aiMessageId: aiMessage.id,
          })}\n\n`;
          controller.enqueue(encoder.encode(initData));

          let fullContent = '';
          const toolCalls: any[] = [];
          let inputTokens = 0;
          let outputTokens = 0;

          // 在开始前检查余额（估算）
          const estimatedOutputTokens = 1000;
          const estimatedCost = calculateLLMCost(modelInfo, 0, estimatedOutputTokens);
          const hasBalance = await checkCreditsBalance(ctx.orgId, estimatedCost);
          if (!hasBalance) {
            const errorData = `data: ${JSON.stringify({
              type: 'error',
              error: 'Insufficient credits balance',
            })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
            return;
          }

          // 调用 LLM 继续对话
          const chatStream = llmClient.chatStream({
            messages,
            tools: agentConfig.tools,
            tool_choice: 'auto', // 让 LLM 决定是否继续调用工具
          });

          for await (const chunk of chatStream) {
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

              await prisma.chatMessages.update({
                where: { id: aiMessage.id },
                data: {
                  content: fullContent,
                  isStreaming: true,
                },
              });

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'content',
                    content: contentDelta,
                    fullContent,
                  })}\n\n`,
                ),
              );
            }

            // 处理工具调用（累积式）
            if (choice.delta?.tool_calls) {
              // 累积tool_calls（流式返回可能分多次）
              for (const toolCall of choice.delta.tool_calls) {
                const index = (toolCall as any).index ?? 0;
                if (!toolCalls[index]) {
                  toolCalls[index] = {
                    id: (toolCall as any).id || `tool_${index}`,
                    type: (toolCall as any).type || 'function',
                    function: {
                      name: '',
                      arguments: '',
                    },
                  };
                }

                if ((toolCall as any).function?.name) {
                  toolCalls[index].function.name = (toolCall as any).function.name;
                }
                if ((toolCall as any).function?.arguments) {
                  toolCalls[index].function.arguments += (toolCall as any).function.arguments;
                }
              }
            }

            // 处理结束
            if (choice.finish_reason) {
              // 如果有工具调用，发送给前端
              if (choice.finish_reason === 'tool_calls' && toolCalls.length > 0) {
                await prisma.chatMessages.update({
                  where: { id: aiMessage.id },
                  data: {
                    content: fullContent,
                    isStreaming: false,
                    isComplete: false, // 等待工具执行结果
                    finishReason: 'tool_calls',
                    toolCalls: toolCalls.filter(tc => tc), // 过滤掉空值
                  },
                });

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'tool_calls',
                      toolCalls: toolCalls.filter(tc => tc), // 过滤掉空值
                      fullContent,
                    })}\n\n`,
                  ),
                );
              } else {
                // 正常结束
                await prisma.chatMessages.update({
                  where: { id: aiMessage.id },
                  data: {
                    content: fullContent,
                    isStreaming: false,
                    isComplete: true,
                    finishReason: choice.finish_reason,
                  },
                });

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'finished',
                      finishReason: choice.finish_reason,
                      fullContent,
                    })}\n\n`,
                  ),
                );
              }
              break;
            }
          }

          // 流式响应完成后，计算并扣除credits
          const cost = calculateLLMCost(modelInfo, inputTokens, outputTokens);
          if (cost > 0) {
            try {
              await deductCredits(ctx.orgId, cost);
              console.log(`[Tool Result] Deducted ${cost} credits for session ${sessionId} (${inputTokens} input + ${outputTokens} output tokens)`);
            } catch (error) {
              console.error(`[Tool Result] Failed to deduct credits for session ${sessionId}:`, error);
              // 注意：这里不抛出错误，因为响应已经发送给客户端了
            }
          }

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
      },
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
