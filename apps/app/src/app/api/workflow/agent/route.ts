/**
 * Agent Workflow
 * 使用 Upstash Workflow 自动执行多轮次对话和工具调用
 */

import { loadModelDefinitionsFromDatabase } from '@/actions/llm';
import { getAgent, getAgentInstance } from '@/agents';
import {
  callLLMWithStream,
  convertPrismaMessagesToUnifiedChat,
  executeTools,
  filterReadyChatMessages,
  saveToolResultsToMessage,
  type LLMCallResult,
} from '@/agents/utils';
import { ReactAgent, type IterationProvider } from '@/agents/core/frameworks/react';
import { getBuiltinToolNames } from '@/agents/core/frameworks/base';
import { buildSystemPrompt } from '@/agents/core/system-prompt';
import CHAT from '@repo/llm/chat';
import { calculateLLMCost, checkCreditsBalance, deductCredits } from '@/lib/server/credit';
import { prisma } from '@/lib/server/prisma';
import { queue } from '@/lib/server/queue';
import { redis } from '@/lib/server/redis';
import { serve } from '@upstash/workflow/nextjs';

interface AgentWorkflowConfig {
  organizationId: string;
  sessionId: string;
  userMessageId: string;
  modelId: string;
  agentId?: string | null;
}

export const { POST } = serve<AgentWorkflowConfig>(async context => {
  const { organizationId, sessionId, userMessageId, modelId, agentId } = context.requestPayload;

  // 更新状态：pending -> processing（开始执行），并保存 workflow run ID
  await context.run('start-processing', async () => {
    // 将 workflow run ID 存储到 session 的某个地方（可以通过 metadata 或其他方式）
    // 这里我们暂时通过日志记录，实际可以通过 Redis 或其他方式存储
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
      await queue.publish({
        url: '/api/queue/summary',
        body: {
          sessionId,
          userMessage: userMessage.content,
          organizationId,
        },
      });
      console.log(`[Workflow] Triggered title generation for session ${sessionId} at start`);
    }
  });

  // ============================================================================
  // 循环说明：
  // 1. Workflow 循环 (roundCount): 处理多轮对话流程
  //    - 每次循环 = 一轮完整对话（加载会话 -> 调用 LLM -> 执行工具 -> 继续）
  //    - 限制：最多 30 轮 (MAX_ROUNDS)
  //
  // 2. ReactAgent 循环 (iteration): ReAct 框架内部的 Think-Act-Observe 迭代
  //    - 在单次 ReactAgent.stream() 调用中，可进行多次迭代
  //    - 遇到工具调用时会 return，退出当前 stream，等待工具结果
  //    - 工具执行后，workflow 继续下一轮循环，再次调用 ReactAgent.stream()
  //    - 限制：最多 100 次迭代 (maxIterations)
  //
  // 关键：ReactAgent 的 iteration 需要跨 workflow 的 roundCount 循环保持！
  // 因为它们是同一个 ReAct 推理过程的延续：
  //   Round 1: iteration 1 (Think) -> iteration 2 (Act: 工具) -> return
  //   工具执行...
  //   Round 2: iteration 3 (Observe + Think) -> iteration 4 (Act) -> return
  //   工具执行...
  //   Round 3: iteration 5 (Observe + Think) -> iteration 6 (Final Answer)
  // ============================================================================

  // 最大轮次限制，避免无限循环
  const MAX_ROUNDS = 30;
  let roundCount = 0;
  let hasError = false;
  let errorMessage: string | null = null;

  // 迭代次数存储键（用于跨 workflow 步骤保持 ReactAgent 的迭代次数）
  const iterationKey = `agent-iteration:${sessionId}`;

  // 初始化迭代次数（如果不存在）
  // 注意：这个迭代次数是 ReactAgent 内部的 ReAct 循环迭代次数，不是 workflow 的 roundCount
  await context.run('init-iteration', async () => {
    const current = await redis.get<number>(iterationKey);
    if (current === null) {
      await redis.set(iterationKey, 0, { ex: 3600 }); // 1小时过期
    }
  });

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

    // 检查会话是否已被中断（状态不再是 processing）
    if (session.status !== 'processing') {
      console.log(`[Workflow] Session ${sessionId} status is ${session.status}, stopping workflow`);
      hasError = true;
      errorMessage = 'Session was cancelled';
      break;
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
    // 过滤并验证消息，获取可以用于 LLM 的就绪消息
    const readyMessages = filterReadyChatMessages(session.messages);

    // 构建消息列表，确保工具调用和工具结果配对
    // 在 workflow 步骤中处理附件（转换图片URL为base64，处理其他附件）
    const systemPrompt = buildSystemPrompt({ preset: agentConfig.promptBlocks, framework: [], dynamic: [] });
    const messages = await context.run(`round-${roundCount}-build-messages`, async () => {
      return await convertPrismaMessagesToUnifiedChat(readyMessages, organizationId, systemPrompt);
    });

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
            modelId: modelId,
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
          modelId: modelId,
        },
      });
    });

    // 再次检查会话是否已被中断（在 LLM 调用前）
    const sessionCheck = await context.run(`round-${roundCount}-check-session`, async () => {
      const currentSession = await prisma.chatSessions.findUnique({
        where: { id: sessionId },
      });
      return currentSession?.status;
    });

    if (sessionCheck !== 'processing') {
      console.log(`[Workflow] Session ${sessionId} was cancelled before LLM call, stopping`);
      hasError = true;
      errorMessage = 'Session was cancelled';
      break;
    }

    // 步骤6：调用 LLM（在步骤内部处理错误，避免步骤名称冲突）
    // 尝试使用 ReactAgent.stream（如果 agent 是 ReactAgent 实例）
    const agentInstance = getAgentInstance(agentId || undefined);
    const isReactAgent = agentInstance instanceof ReactAgent;

    const llmResult = await context.run(`round-${roundCount}-call-llm`, async () => {
      if (isReactAgent) {
        // 使用 ReactAgent.stream（支持微代理）
        CHAT.setModels(allModels);
        const llmClient = CHAT.createClient(modelId);

        let fullContent = '';
        const toolCalls: any[] = [];
        let finishReason: string | null = null;
        let inputTokens = 0;
        let outputTokens = 0;
        const cachedInputTokens = 0;
        const cachedOutputTokens = 0;

        // 从 Redis 读取当前迭代次数，并创建同步的迭代次数提供者
        // 使用内存变量在本次调用中维护迭代次数，并在每次递增时同步更新 Redis
        let currentIteration = (await redis.get<number>(iterationKey)) ?? 0;
        const iterationProvider: IterationProvider = {
          getIteration: () => currentIteration,
          incrementIteration: () => {
            currentIteration++;
            // 异步更新 Redis（不阻塞）
            redis.set(iterationKey, currentIteration, { ex: 3600 }).catch(err => {
              console.error(`[Workflow] Failed to update iteration count in Redis:`, err);
            });
            return currentIteration;
          },
          resetIteration: () => {
            currentIteration = 0;
            redis.del(iterationKey).catch(err => {
              console.error(`[Workflow] Failed to reset iteration count in Redis:`, err);
            });
          },
        };

        const stream = (agentInstance as ReactAgent).stream(llmClient, messages, [], {
          modelId,
          sessionId, // 传递 sessionId，用于获取动态系统提示词片段
          iterationProvider, // 传递迭代次数提供者
        });

        for await (const chunk of stream) {
          // 累积 token 使用
          if (chunk.tokenUsage) {
            inputTokens += chunk.tokenUsage.promptTokens || 0;
            outputTokens += chunk.tokenUsage.completionTokens || 0;
          }

          // 处理最终答案
          if (chunk.type === 'final_answer') {
            fullContent += chunk.content;
          }

          // 处理工具调用（ReactAgent 会在 action 类型中输出工具调用信息）
          if (chunk.type === 'action' && chunk.toolName) {
            // 从 action chunk 中提取工具调用信息
            if (!toolCalls.find(tc => tc.function.name === chunk.toolName)) {
              // toolArgs 应该已经是解析后的对象，直接序列化
              let argumentsStr: string;
              if (typeof chunk.toolArgs === 'string') {
                // 如果已经是字符串，检查是否是 "[object Object]" 这种错误转换
                if (chunk.toolArgs === '[object Object]') {
                  console.error(`[Workflow] Tool ${chunk.toolName} has invalid toolArgs: "[object Object]"`);
                  argumentsStr = JSON.stringify({});
                } else {
                  // 检查是否是有效的 JSON
                  try {
                    JSON.parse(chunk.toolArgs);
                    argumentsStr = chunk.toolArgs;
                  } catch {
                    // 如果不是有效的 JSON，当作空对象处理
                    console.error(`[Workflow] Tool ${chunk.toolName} has invalid JSON string in toolArgs:`, chunk.toolArgs);
                    argumentsStr = JSON.stringify({});
                  }
                }
              } else if (typeof chunk.toolArgs === 'object' && chunk.toolArgs !== null) {
                // 如果是对象，序列化为 JSON 字符串
                argumentsStr = JSON.stringify(chunk.toolArgs);
              } else {
                // 其他情况（null、undefined 等），使用空对象
                argumentsStr = JSON.stringify({});
              }

              toolCalls.push({
                id: `tool_${toolCalls.length}`,
                type: 'function',
                function: {
                  name: chunk.toolName,
                  arguments: argumentsStr,
                },
              });
            }
            finishReason = 'tool_calls';
          }
        }

        // 如果没有工具调用，说明是最终答案
        if (toolCalls.length === 0 && fullContent) {
          finishReason = 'stop';
        } else if (toolCalls.length > 0) {
          finishReason = 'tool_calls';
        }

        return {
          success: true,
          data: {
            content: fullContent,
            toolCalls: finishReason === 'tool_calls' ? toolCalls : [],
            finishReason,
          },
          inputTokens,
          outputTokens,
          cachedInputTokens,
          cachedOutputTokens,
        } as LLMCallResult;
      } else {
        // 使用传统的 callLLMWithStream
        return await callLLMWithStream(modelId, allModels, messages, agentConfig.tools);
      }
    });

    // 如果LLM调用失败，处理错误
    if (!llmResult.success || !llmResult.data) {
      const llmErrorMessage = ('error' in llmResult ? llmResult.error : undefined) || 'Unknown error';
      await context.run(`round-${roundCount}-update-ai-message`, async () => {
        await prisma.chatMessages.update({
          where: { id: aiMessage.id },
          data: {
            content: `错误: ${llmErrorMessage}`,
            isComplete: true,
            isStreaming: false,
          },
        });
      });

      hasError = true;
      errorMessage = `LLM调用失败: ${llmErrorMessage}`;
      break;
    }

    const llmResponse = llmResult.data;
    const inputTokens = llmResult.inputTokens;
    const outputTokens = llmResult.outputTokens;
    const cachedInputTokens = llmResult.cachedInputTokens || 0;
    const cachedOutputTokens = llmResult.cachedOutputTokens || 0;

    // 步骤7：更新 AI 消息
    await context.run(`round-${roundCount}-update-ai-message`, async () => {
      await prisma.chatMessages.update({
        where: { id: aiMessage.id },
        data: {
          content: llmResponse.content,
          isComplete: llmResponse.finishReason !== 'tool_calls',
          toolCalls: llmResponse.toolCalls.length > 0 ? llmResponse.toolCalls : undefined,
          finishReason: llmResponse.finishReason,
          tokenCount: inputTokens + outputTokens,
          inputTokens: inputTokens,
          outputTokens: outputTokens,
          cachedInputTokens: cachedInputTokens > 0 ? cachedInputTokens : null,
          cachedOutputTokens: cachedOutputTokens > 0 ? cachedOutputTokens : null,
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
      // 在执行工具前再次检查中断状态
      const toolCheckSession = await context.run(`round-${roundCount}-check-before-tools`, async () => {
        const currentSession = await prisma.chatSessions.findUnique({
          where: { id: sessionId },
        });
        return currentSession?.status;
      });

      if (toolCheckSession !== 'processing') {
        console.log(`[Workflow] Session ${sessionId} was cancelled before tool execution, stopping`);
        hasError = true;
        errorMessage = 'Session was cancelled';
        break;
      }

      // 执行服务端工具
      // 创建 LLM 客户端供工具使用
      CHAT.setModels(allModels);
      const llmClient = CHAT.createClient(modelId);

      const toolExecutionResult = await executeTools(llmResponse.toolCalls, {
        organizationId,
        sessionId,
        workflow: context,
        messageId: aiMessage.id,
        llmClient,
        messages,
        reactAgent: isReactAgent ? (agentInstance as ReactAgent) : undefined,
        builtinToolNames: getBuiltinToolNames(agentConfig),
      });

      // 如果工具执行期间使用了 token，将其计入总使用量
      let toolInputTokens = 0;
      let toolOutputTokens = 0;
      if (toolExecutionResult.tokenUsage) {
        toolInputTokens = toolExecutionResult.tokenUsage.promptTokens;
        toolOutputTokens = toolExecutionResult.tokenUsage.completionTokens;

        // 更新消息的 token 计数，包含工具执行的 token
        await context.run(`round-${roundCount}-update-tool-tokens`, async () => {
          const currentMessage = await prisma.chatMessages.findUnique({
            where: { id: aiMessage.id },
            select: { inputTokens: true, outputTokens: true, tokenCount: true },
          });

          if (currentMessage) {
            const totalInputTokens = (currentMessage.inputTokens || 0) + toolInputTokens;
            const totalOutputTokens = (currentMessage.outputTokens || 0) + toolOutputTokens;
            const totalTokenCount = (currentMessage.tokenCount || 0) + toolInputTokens + toolOutputTokens;

            await prisma.chatMessages.update({
              where: { id: aiMessage.id },
              data: {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
                tokenCount: totalTokenCount,
              },
            });
          }
        });

        // 扣除工具执行产生的费用
        const toolCost = calculateLLMCost(modelInfo, toolInputTokens, toolOutputTokens);
        if (toolCost > 0) {
          await context.run(`round-${roundCount}-deduct-tool-credits`, async () => {
            await deductCredits(organizationId, toolCost);
          });
        }
      }

      // 保存服务端工具结果到 assistant 消息的 toolResults 字段
      await context.run(`round-${roundCount}-save-server-tool-results`, async () => {
        await saveToolResultsToMessage(aiMessage.id, llmResponse.toolCalls, toolExecutionResult.results);
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

  // 如果被中断，创建中断消息
  if (hasError && errorMessage === 'Session was cancelled') {
    await context.run('handle-cancellation', async () => {
      // 查找最后一条未完成的 assistant 消息
      const lastIncompleteMessage = await prisma.chatMessages.findFirst({
        where: {
          sessionId,
          role: 'assistant',
          isComplete: false,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (lastIncompleteMessage) {
        await prisma.chatMessages.update({
          where: { id: lastIncompleteMessage.id },
          data: {
            isComplete: true,
            isStreaming: false,
            content: lastIncompleteMessage.content ? `${lastIncompleteMessage.content}\n\n[已中断]` : '[已中断]',
          },
        });
      }
    });
  }

  // 更新状态：processing -> idle（执行完成或失败都设为idle，避免阻塞新消息）
  // 使用 context.run 确保即使 workflow 执行失败，状态也能被重置
  await context.run('finish-processing', async () => {
    await prisma.chatSessions.update({
      where: { id: sessionId },
      data: {
        status: 'idle', // 无论成功还是失败，都设为idle，避免阻塞新消息
        updatedAt: new Date(),
      },
    });

    // 清理迭代次数（对话完成）
    await redis.del(iterationKey).catch(err => {
      console.error(`[Workflow] Failed to cleanup iteration count:`, err);
    });
  });
});
