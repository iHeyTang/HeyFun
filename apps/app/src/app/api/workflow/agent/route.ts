/**
 * Agent Workflow
 * 使用 Upstash Workflow 自动执行多轮次对话和工具调用
 */

import { loadModelDefinitionsFromDatabase } from '@/actions/llm';
import { getAgent } from '@/agents';
import { callLLMWithStream, convertPrismaMessagesToUnifiedChat, executeTools, filterReadyChatMessages, saveToolResultsToMessage } from '@/agents/utils';
import { calculateLLMCost, checkCreditsBalance, deductCredits } from '@/lib/server/credit';
import { prisma } from '@/lib/server/prisma';
import { queue } from '@/lib/server/queue';
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

  // 最大轮次限制，避免无限循环
  const MAX_ROUNDS = 30;
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
    const messages = await context.run(`round-${roundCount}-build-messages`, async () => {
      return await convertPrismaMessagesToUnifiedChat(readyMessages, organizationId, agentConfig.systemPrompt);
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
    const llmResult = await context.run(`round-${roundCount}-call-llm`, async () => {
      return await callLLMWithStream(modelId, allModels, messages, agentConfig.tools);
    });

    // 如果LLM调用失败，处理错误
    if (!llmResult.success || !llmResult.data) {
      const llmErrorMessage = llmResult.error || 'Unknown error';
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
      // 注意：如果工具调用了 waitForEvent（如 human_in_loop），workflow 会在这里暂停，直到事件被触发
      const serverToolResults = await executeTools(llmResponse.toolCalls, {
        organizationId,
        sessionId,
        workflow: context,
        messageId: aiMessage.id,
      });

      // 保存服务端工具结果到 assistant 消息的 toolResults 字段
      // 注意：human_in_loop 工具已经在 executor 中保存了初始数据，这里只需要更新最终结果
      await context.run(`round-${roundCount}-save-server-tool-results`, async () => {
        await saveToolResultsToMessage(aiMessage.id, llmResponse.toolCalls, serverToolResults);
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
  });
});
