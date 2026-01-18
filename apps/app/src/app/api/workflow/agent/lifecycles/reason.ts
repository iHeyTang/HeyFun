/**
 * Workflow Reason 阶段（LLM 推理阶段）
 */

import { getReactAgentInstance } from '@/agents';
import type { AgentConfig } from '@/agents/core/frameworks/base';
import type { IterationProvider } from '@/agents/core/frameworks/react';
import { buildSystemPrompt } from '@/agents/core/system-prompt';
import { convertPrismaMessagesToUnifiedChat, filterReadyChatMessages } from '@/agents/utils';
import { realtime } from '@/lib/realtime';
import { calculateLLMCost, checkCreditsBalance } from '@/lib/server/credit';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import type { ModelInfo } from '@/llm/chat';
import CHAT, { UnifiedChat } from '@/llm/chat';
import { ChatMessages, ChatSessions } from '@prisma/client';
import { processToolCallChunk } from '../utils/stream-handler';
import { PrepareResult } from './prepare';

const PUSH_DEBOUNCE_MS = 200; // 200ms debounce
const MAX_STREAM_RETRIES = 3; // 最大重试次数
const STREAM_RETRY_DELAY_MS = 1000; // 重试延迟（毫秒）

interface ReasonParams {
  prepare: PrepareResult;
  extraMessages?: UnifiedChat.Message[]; // 临时消息（不持久化）
}

interface ReasonContext {
  sessionId: string;
  organizationId: string;
  modelId: string;
  agentId?: string | null;
}

export interface ReasonResult {
  session: ChatSessions;
  messages: UnifiedChat.Message[];
  aiMessage: ChatMessages | null;
  reasonTime: number;
  roundStartTime: number;
  /** LLM 推理阶段的 token 使用情况 */
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    cachedOutputTokens: number;
  };
}

export async function executeReason(params: ReasonParams, context: ReasonContext): Promise<ReasonResult> {
  const { prepare, extraMessages } = params;
  const { modelInfo, agentConfig, allModels } = prepare;
  const { sessionId, organizationId, modelId, agentId } = context;
  const roundStartTime = Date.now();

  // 步骤1：获取会话和消息历史
  const session = await prisma.chatSessions.findUnique({ where: { id: sessionId, organizationId } });

  if (!session) {
    throw new Error('Session not found');
  }
  if (session.status !== 'processing') {
    // 状态不是 processing（可能是 cancelling 或 idle，用户取消了），优雅停止 workflow
    console.log(`[Workflow] Session ${sessionId} status is ${session.status}, stopping workflow gracefully`);
    return {
      session,
      messages: [],
      aiMessage: null,
      reasonTime: 0,
      roundStartTime,
      tokenUsage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cachedOutputTokens: 0 },
    };
  }

  // 步骤2：检查余额
  const estimatedOutputTokens = 1000;
  const estimatedCost = calculateLLMCost(modelInfo, 0, estimatedOutputTokens);
  const hasBalance = await checkCreditsBalance(organizationId, estimatedCost);
  if (!hasBalance) {
    throw new Error('Insufficient balance');
  }

  // 步骤3：构建消息历史
  const historyMessages = await prisma.chatMessages.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
  const readyMessages = filterReadyChatMessages(historyMessages);
  const systemPrompt = buildSystemPrompt({ preset: agentConfig.promptBlocks, framework: [], dynamic: [] });
  const messages = await convertPrismaMessagesToUnifiedChat(readyMessages, organizationId, systemPrompt);

  // 添加临时消息（不持久化）
  if (extraMessages && extraMessages.length > 0) {
    messages.push(...extraMessages);
  }

  // 步骤4：创建 AI 消息占位
  const aiMessage = await prisma.chatMessages.create({
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

  // 步骤5：再次检查会话是否已被中断（在 LLM 调用前）
  const sessionBeforeChat = await prisma.chatSessions.findUnique({ where: { id: sessionId } });
  if (!sessionBeforeChat) {
    throw new Error('Session not found');
  }
  if (sessionBeforeChat?.status !== 'processing') {
    console.log(`[Workflow] Session ${sessionId} status is ${sessionBeforeChat?.status}, stopping workflow gracefully before LLM call`);
    return {
      session: sessionBeforeChat,
      messages,
      aiMessage,
      reasonTime: 0,
      roundStartTime,
      tokenUsage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cachedOutputTokens: 0 },
    };
  }

  // 步骤6：调用 LLM
  const reasonStartTime = Date.now();
  CHAT.setModels(allModels);
  const llmClient = CHAT.createClient(modelId);

  let fullContent = '';
  let toolCalls: UnifiedChat.ToolCall[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  const cachedInputTokens = 0;
  const cachedOutputTokens = 0;

  // 从 Redis 读取当前迭代次数，并创建同步的迭代次数提供者
  const iterationKey = `agent-iteration:${sessionId}`;
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

  const agentInstance = getReactAgentInstance(agentId || undefined);
  const nextStepMessage: UnifiedChat.Message = { role: 'assistant', content: agentInstance.getNextStepPrompt() };

  // Debounce 推送：避免过于频繁的实时更新
  let lastPushTime = 0;

  // 安全的实时推送函数（不阻塞流处理）
  const safeEmitContent = async (content: string) => {
    const now = Date.now();
    if (now - lastPushTime >= PUSH_DEBOUNCE_MS) {
      lastPushTime = now;
      await realtime
        // @ts-expect-error - @upstash/realtime 的类型推断问题，schema 中使用了 z.any() 导致类型推断失败
        .emit('message.content', {
          sessionId,
          messageId: aiMessage.id,
          content,
          isComplete: false,
        })
        .catch(err => {
          // realtime 错误不应该中断流处理，只记录日志
          console.error(`[Workflow] Failed to emit message.content for session ${sessionId}, message ${aiMessage.id}:`, err);
        });
    }
  };

  // 重试流式处理
  let attemptCount = 0;
  let streamCompleted = false;

  while (!streamCompleted && attemptCount < MAX_STREAM_RETRIES + 1) {
    attemptCount++;
    try {
      // 每次重试都重新创建流
      const stream = agentInstance.reason(llmClient, [nextStepMessage], messages, { modelId, sessionId, iterationProvider });

      // 只对流的迭代使用 try-catch
      for await (const chunk of stream) {
        // 处理文本内容
        if (chunk.type === 'content' && chunk.content) {
          fullContent += chunk.content;
          // 实时推送（失败不影响流处理）
          await safeEmitContent(fullContent);
        }

        // 处理工具调用
        if (chunk.type === 'tool_call' && chunk.toolCall) {
          toolCalls = processToolCallChunk(chunk, toolCalls);
        }

        // 处理 token 使用情况
        if (chunk.type === 'token_usage' && chunk.tokenUsage) {
          inputTokens += chunk.tokenUsage.promptTokens || 0;
          outputTokens += chunk.tokenUsage.completionTokens || 0;
        }
      }

      // 流正常完成
      streamCompleted = true;
    } catch (streamError: unknown) {
      // 流读取错误（主要是连接中断）
      const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
      const errorCause = streamError instanceof Error ? streamError.cause : undefined;

      console.warn(`[Workflow] Stream error, attempt ${attemptCount}/${MAX_STREAM_RETRIES + 1}, session ${sessionId}, message ${aiMessage.id}:`, {
        error: errorMessage,
        cause: errorCause,
        collectedContentLength: fullContent.length,
        collectedToolCalls: toolCalls.length,
      });

      if (attemptCount <= MAX_STREAM_RETRIES) {
        // 重试前检查会话状态
        const sessionCheck = await prisma.chatSessions.findUnique({ where: { id: sessionId } });
        if (!sessionCheck || sessionCheck.status !== 'processing') {
          console.log(`[Workflow] Session ${sessionId} status is ${sessionCheck?.status || 'not found'}, stopping retry`);
          throw new Error(`Session ${sessionCheck?.status || 'not found'}, cannot retry`);
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, STREAM_RETRY_DELAY_MS));
      } else {
        // 重试次数用尽
        throw new Error(`Stream error after ${MAX_STREAM_RETRIES} retries: ${errorMessage}`);
      }
    }
  }

  // 计算 reason 阶段耗时
  const reasonTime = Date.now() - reasonStartTime;

  // 步骤6（Reason）只负责收集 LLM 响应，不做任何判定
  const llmResult = {
    success: true,
    data: {
      content: fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : [],
    },
    inputTokens,
    outputTokens,
    cachedInputTokens,
    cachedOutputTokens,
  };

  // 步骤7：更新 AI 消息
  const currentMessage = await prisma.chatMessages.findUnique({
    where: { id: aiMessage.id },
    select: { metadata: true },
  });

  const metadata = currentMessage?.metadata || {};
  metadata.timing = {
    ...(metadata.timing || {}),
    reasonTime: reasonTime,
  };

  const reasonAiMessage = await prisma.chatMessages.update({
    where: { id: aiMessage.id },
    data: {
      content: llmResult.data.content,
      isComplete: false, // 只有调用了 complete 工具才会设置为 true（在步骤13中处理）
      toolCalls: llmResult.data.toolCalls.length > 0 ? llmResult.data.toolCalls : undefined,
      tokenCount: llmResult.inputTokens + llmResult.outputTokens,
      inputTokens: llmResult.inputTokens,
      outputTokens: llmResult.outputTokens,
      cachedInputTokens: llmResult.cachedInputTokens > 0 ? llmResult.cachedInputTokens : null,
      cachedOutputTokens: llmResult.cachedOutputTokens > 0 ? llmResult.cachedOutputTokens : null,
      metadata: metadata,
    },
  });

  // 推送消息完整更新
  // @ts-expect-error - @upstash/realtime 的类型推断问题，schema 中使用了 z.any() 导致类型推断失败
  await realtime.emit('message.update', {
    sessionId,
    messageId: aiMessage.id,
    data: {
      content: llmResult.data.content,
      toolCalls: llmResult.data.toolCalls.length > 0 ? llmResult.data.toolCalls : undefined,
      isComplete: false,
      metadata: metadata,
    },
  });

  // 步骤8: 再次检查会话是否已被中断
  // 注意：扣费逻辑统一在 observe 阶段执行
  const finalSession = await prisma.chatSessions.findUnique({ where: { id: sessionId } });
  if (!finalSession) {
    throw new Error('Session not found');
  }
  if (finalSession?.status !== 'processing') {
    console.log(`[Workflow] Session ${sessionId} status is ${finalSession?.status}, stopping workflow gracefully after tools`);
  }
  return {
    session: finalSession,
    messages,
    aiMessage: reasonAiMessage,
    reasonTime,
    roundStartTime,
    tokenUsage: {
      inputTokens: llmResult.inputTokens,
      outputTokens: llmResult.outputTokens,
      cachedInputTokens: llmResult.cachedInputTokens,
      cachedOutputTokens: llmResult.cachedOutputTokens,
    },
  };
}
