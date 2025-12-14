/**
 * Agent Workflow
 * 使用 Upstash Workflow 自动执行多轮次对话和工具调用
 */

import { prisma } from '@/lib/server/prisma';
import CHAT, { UnifiedChat } from '@repo/llm/chat';
import { serve } from '@upstash/workflow/nextjs';
import { getAgent } from '@/agents';
import { calculateLLMCost, deductCredits, checkCreditsBalance } from '@/lib/server/credit';
import { loadModelDefinitionsFromDatabase } from '@/actions/llm';
import { ToolResult } from '@/agents/core/tools/tool-definition';
import { generalToolbox } from '@/agents/toolboxes/general-toolbox';
import { webSearchToolbox } from '@/agents/toolboxes/web-search-toolbox';
import { queue } from '@/lib/server/queue';

interface AgentWorkflowConfig {
  organizationId: string;
  sessionId: string;
  userMessageId: string;
  modelId: string;
  agentId?: string | null;
}

// 客户端工具列表（需要前端上下文，无法在后端执行）
const CLIENT_TOOLS = new Set([
  'edit_flow_canvas',
  'get_canvas_state',
  'get_canvas_capabilities',
  'get_node_type_info',
  'auto_layout_canvas',
  'run_canvas_workflow',
]);

/**
 * 执行工具调用（后端版本）
 * 使用 generalToolbox 和 webSearchToolbox 来执行服务端工具
 */
async function executeTools(toolCalls: any[], context: { organizationId: string; sessionId: string }): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const toolCall of toolCalls) {
    const toolName = toolCall.function?.name;

    if (!toolName) {
      results.push({
        success: false,
        error: 'Tool name is missing',
      });
      continue;
    }

    // 检查是否是客户端工具
    if (CLIENT_TOOLS.has(toolName)) {
      results.push({
        success: false,
        error: `Tool "${toolName}" requires client-side context and cannot be executed on the server. Please use the web interface to interact with canvas tools.`,
        message: `工具 "${toolName}" 需要在客户端执行，无法在后端执行。请使用 Web 界面与画布工具交互。`,
      });
      continue;
    }

    // 尝试使用 generalToolbox 执行工具
    let result: ToolResult | null = null;
    if (generalToolbox.has(toolName)) {
      try {
        result = await generalToolbox.execute(toolCall, {
          organizationId: context.organizationId,
          sessionId: context.sessionId,
        });
      } catch (error) {
        result = {
          success: false,
          error: `Failed to execute tool "${toolName}": ${(error as Error).message}`,
        };
      }
    } else if (webSearchToolbox.has(toolName)) {
      // 如果 generalToolbox 没有，尝试 webSearchToolbox
      try {
        result = await webSearchToolbox.execute(toolCall, {
          organizationId: context.organizationId,
          sessionId: context.sessionId,
        });
      } catch (error) {
        result = {
          success: false,
          error: `Failed to execute tool "${toolName}": ${(error as Error).message}`,
        };
      }
    } else {
      // 工具未找到
      result = {
        success: false,
        error: `Tool "${toolName}" is not registered. Available tools: ${[
          ...generalToolbox.getAllToolNames(),
          ...webSearchToolbox.getAllToolNames(),
        ].join(', ')}`,
      };
    }

    if (result) {
      results.push(result);
    }
  }

  return results;
}

export const { POST } = serve<AgentWorkflowConfig>(async context => {
  const { organizationId, sessionId, userMessageId, modelId, agentId } = context.requestPayload;

  // 更新状态：pending -> processing（开始执行）
  await context.run('start-processing', async () => {
    await prisma.chatSessions.update({
      where: { id: sessionId },
      data: { status: 'processing' },
    });
  });

  // 检查并触发标题生成（如果需要）
  await context.run('check-and-trigger-title-generation', async () => {
    // 获取用户消息内容
    const userMessage = await prisma.chatMessages.findUnique({
      where: { id: userMessageId },
    });

    if (!userMessage) {
      return;
    }

    // 检查是否需要生成标题
    const session = await prisma.chatSessions.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          where: { role: 'user' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    // 如果是第一条用户消息，且标题为空或者是默认标题，则需要生成标题
    const shouldGenerateTitle =
      session && session.messages.length === 1 && session.messages[0]?.id === userMessageId && (!session.title || session.title === 'New Chat');

    // 如果需要生成标题，立即触发异步标题生成任务（不阻塞主流程）
    if (shouldGenerateTitle) {
      try {
        await queue.publish({
          url: '/api/queue/summary',
          body: {
            sessionId,
            userMessage: userMessage.content,
            organizationId,
          },
        });
        console.log(`[Workflow] Triggered title generation for session ${sessionId} at start`);
      } catch (error) {
        console.error('[Workflow] Failed to trigger title generation:', error);
        // 标题生成失败不影响主流程，只记录错误
      }
    }
  });

  // 最大轮次限制，避免无限循环
  const MAX_ROUNDS = 10;
  let roundCount = 0;
  let hasError = false;
  let errorMessage: string | null = null;

  // 主循环：处理多轮次对话
  while (roundCount < MAX_ROUNDS) {
    roundCount++;

    // 步骤1：获取会话和消息历史
    const session = await context.run(`round-${roundCount}-load-session`, async () => {
      return await prisma.chatSessions.findUnique({
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
    });

    if (!session) {
      hasError = true;
      errorMessage = 'Session not found';
      throw new Error('Session not found');
    }

    // 步骤2：加载 Agent 配置和模型
    const [agentConfig, allModels] = await Promise.all([
      context.run(`round-${roundCount}-load-agent`, async () => {
        return getAgent(agentId || undefined);
      }),
      context.run(`round-${roundCount}-load-models`, async () => {
        return await loadModelDefinitionsFromDatabase();
      }),
    ]);

    const modelInfo = allModels.find(m => m.id === modelId);
    if (!modelInfo) {
      hasError = true;
      errorMessage = `Model ${modelId} not found`;
      throw new Error(`Model ${modelId} not found`);
    }

    // 步骤3：构建消息历史
    // 过滤消息：确保工具调用和工具结果正确配对
    // 关键：只包含已完成的消息，但 assistant 消息如果有 toolCalls 即使 isComplete=false 也要包含
    const filteredMessages = session.messages.filter(msg => {
      // 排除当前正在处理的 AI 消息（isComplete=false 且没有 toolCalls）
      if (msg.role === 'assistant' && !msg.isComplete && !msg.toolCalls) {
        return false;
      }

      // 如果是 assistant 消息且有 toolCalls，即使 isComplete=false 也要保留
      // 但需要确保对应的 tool 消息都已创建
      if (msg.role === 'assistant' && msg.toolCalls) {
        // 检查是否有对应的 tool 消息
        const toolCallIds = (msg.toolCalls as any[]).map((tc: any) => tc.id);
        const toolMessages = session.messages.filter(m => m.role === 'tool' && m.toolCallId && toolCallIds.includes(m.toolCallId));
        // 只有当所有工具调用都有对应的工具结果消息时，才包含这个 assistant 消息
        // 或者如果 assistant 消息 isComplete=false，说明工具还在执行中，不应该包含
        if (!msg.isComplete) {
          // 如果 assistant 消息未完成，检查是否所有工具结果都已创建
          return toolMessages.length === toolCallIds.length;
        }
        return true;
      }

      // 如果是 tool 消息，检查是否完成
      if (msg.role === 'tool') {
        return msg.isComplete;
      }

      // 其他消息只保留完成的
      return msg.isComplete && !msg.isStreaming;
    });

    // 构建消息列表，确保工具调用和工具结果配对
    // 需要确保每个 assistant 消息的 tool_calls 都有对应的 tool 消息
    const messages: UnifiedChat.Message[] = [{ role: 'system' as const, content: agentConfig.systemPrompt }];

    // 按顺序处理消息，确保工具调用和工具结果配对
    for (const msg of filteredMessages) {
      if (msg.role === 'assistant' && msg.toolCalls) {
        // 对于有 toolCalls 的 assistant 消息，需要确保所有工具结果都存在
        const toolCallIds = (msg.toolCalls as any[]).map((tc: any) => tc.id);
        const toolMessages = filteredMessages.filter(m => m.role === 'tool' && m.toolCallId && toolCallIds.includes(m.toolCallId));

        // 只有当工具结果数量等于工具调用数量时，才添加这条消息
        if (toolMessages.length === toolCallIds.length) {
          const baseMsg: any = {
            role: 'assistant' as const,
            content: msg.content,
            tool_calls: msg.toolCalls,
          };
          messages.push(baseMsg);

          // 添加对应的 tool 消息
          for (const toolCallId of toolCallIds) {
            const toolMsg = toolMessages.find(m => m.toolCallId === toolCallId);
            if (toolMsg) {
              messages.push({
                role: 'tool' as const,
                content: toolMsg.content,
                tool_call_id: toolMsg.toolCallId!,
              });
            }
          }
        }
      } else if (msg.role === 'tool') {
        // tool 消息已经在上面处理了，跳过
        continue;
      } else {
        // 普通消息直接添加
        const baseMsg: any = {
          role: msg.role as UnifiedChat.Message['role'],
          content: msg.content,
        };
        messages.push(baseMsg);
      }
    }

    // 步骤4：检查余额
    const estimatedOutputTokens = 1000;
    const estimatedCost = calculateLLMCost(modelInfo, 0, estimatedOutputTokens);
    const hasBalance = await context.run(`round-${roundCount}-check-balance`, async () => {
      return await checkCreditsBalance(organizationId, estimatedCost);
    });

    if (!hasBalance) {
      await context.run(`round-${roundCount}-insufficient-balance`, async () => {
        await prisma.chatMessages.create({
          data: {
            sessionId,
            organizationId,
            role: 'assistant',
            content: '余额不足，无法继续对话。请充值后重试。',
            isComplete: true,
            isStreaming: false,
          },
        });
      });
      break;
    }

    // 步骤5：创建 AI 消息占位
    const aiMessage = await context.run(`round-${roundCount}-create-ai-message`, async () => {
      return await prisma.chatMessages.create({
        data: {
          sessionId,
          organizationId,
          role: 'assistant',
          content: '',
          isStreaming: false,
          isComplete: false,
        },
      });
    });

    // 步骤6：调用 LLM
    const [llmResponse, inputTokens, outputTokens] = await context.run(`round-${roundCount}-call-llm`, async () => {
      // 在 context.run 内部设置模型和创建客户端，避免重复创建
      CHAT.setModels(allModels);
      const llmClient = CHAT.createClient(modelId);

      const chatParams: UnifiedChat.ChatCompletionParams = {
        messages,
        ...(agentConfig.tools.length > 0 && {
          tools: agentConfig.tools,
          tool_choice: 'auto' as const,
        }),
      };

      let inputTokens = 0;
      let outputTokens = 0;
      let fullContent = '';
      const toolCalls: any[] = [];
      let finishReason: string | null = null;

      const stream = llmClient.chatStream(chatParams);

      for await (const chunk of stream) {
        if (chunk.usage) {
          inputTokens += chunk.usage.prompt_tokens || 0;
          outputTokens += chunk.usage.completion_tokens || 0;
        }

        const choice = chunk.choices?.[0];
        if (!choice) continue;

        if (choice.delta?.content) {
          fullContent += choice.delta.content;
        }

        if (choice.delta?.tool_calls) {
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
              if ((toolCall as any).function?.name) {
                toolCalls[index].function.name = (toolCall as any).function.name;
              }
              if ((toolCall as any).function?.arguments) {
                toolCalls[index].function.arguments += (toolCall as any).function.arguments;
              }
            }
          }
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
          break;
        }
      }

      return [
        {
          content: fullContent,
          toolCalls: finishReason === 'tool_calls' ? toolCalls.filter(tc => tc) : [],
          finishReason,
        },
        inputTokens,
        outputTokens,
      ] as const;
    });

    // 步骤7：更新 AI 消息
    await context.run(`round-${roundCount}-update-ai-message`, async () => {
      await prisma.chatMessages.update({
        where: { id: aiMessage.id },
        data: {
          content: llmResponse.content,
          isComplete: llmResponse.finishReason !== 'tool_calls',
          toolCalls: llmResponse.toolCalls.length > 0 ? llmResponse.toolCalls : null,
          finishReason: llmResponse.finishReason,
        },
      });
    });

    // 步骤8：扣除费用
    const cost = calculateLLMCost(modelInfo, inputTokens, outputTokens);
    if (cost > 0) {
      await context.run(`round-${roundCount}-deduct-credits`, async () => {
        await deductCredits(organizationId, cost);
      });
    }

    // 步骤9：如果有工具调用，执行工具
    if (llmResponse.toolCalls.length > 0) {
      const toolResults = await context.run(`round-${roundCount}-execute-tools`, async () => {
        return await executeTools(llmResponse.toolCalls, {
          organizationId,
          sessionId,
        });
      });

      // 保存工具结果消息
      await context.run(`round-${roundCount}-save-tool-results`, async () => {
        for (let i = 0; i < llmResponse.toolCalls.length; i++) {
          const toolCall = llmResponse.toolCalls[i];
          const result = toolResults[i];

          if (toolCall && result) {
            await prisma.chatMessages.create({
              data: {
                sessionId,
                organizationId,
                role: 'tool',
                content: JSON.stringify(result),
                toolCallId: toolCall.id,
                isComplete: true,
              },
            });
          }
        }
      });

      // 继续下一轮对话（工具执行后需要继续）
      continue;
    }

    // 如果没有工具调用，对话完成
    await context.run(`round-${roundCount}-complete`, async () => {
      await prisma.chatMessages.update({
        where: { id: aiMessage.id },
        data: {
          isComplete: true,
        },
      });

      await prisma.chatSessions.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });
    });

    // 对话完成，退出循环
    break;
  }

  // 如果达到最大轮次，标记为完成
  if (roundCount >= MAX_ROUNDS) {
    await context.run('max-rounds-reached', async () => {
      await prisma.chatMessages.create({
        data: {
          sessionId,
          organizationId,
          role: 'assistant',
          content: `已达到最大轮次限制（${MAX_ROUNDS} 轮），对话已结束。`,
          isComplete: true,
          isStreaming: false,
        },
      });
    });
  }

  // 更新状态：processing -> idle（执行完成）或 failed（执行失败）
  await context.run('finish-processing', async () => {
    await prisma.chatSessions.update({
      where: { id: sessionId },
      data: {
        status: hasError ? 'failed' : 'idle',
        updatedAt: new Date(),
      },
    });
  });
});
