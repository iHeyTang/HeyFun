/**
 * Workflow Observe 阶段（观察工具执行结果）
 */

import { CompletionInfo, getSessionCompletion } from '@/agents/tools/context';
import { calculateLLMCost, deductCredits } from '@/lib/server/credit';
import { realtime } from '@/lib/realtime';
import { prisma } from '@/lib/server/prisma';
import type { ModelInfo } from '@/llm/chat';
import { ToolExecutionResult } from './action';
import { ReasonResult } from './reason';
import { PrepareResult } from './prepare';

interface ObserveParams {
  prepare: PrepareResult;
  reason: ReasonResult;
  action: ToolExecutionResult;
}

interface ObserveContext {
  sessionId: string;
  organizationId: string;
  modelId: string;
  agentId?: string | null;
}

export interface ObserveResult {
  completion: CompletionInfo | null;
  observationTime: number;
}

export async function executeObserve(params: ObserveParams, context: ObserveContext): Promise<ObserveResult> {
  const { prepare, reason, action } = params;
  const { sessionId, organizationId } = context;
  const { modelInfo } = prepare;
  const observationStartTime = Date.now();

  // 统一扣费：汇总 reason（LLM推理）+ action（工具内LLM调用）的 token 使用
  const reasonTokens = reason.tokenUsage;
  const actionTokens = action.tokenUsage;
  const totalInputTokens = reasonTokens.inputTokens + (actionTokens?.promptTokens || 0);
  const totalOutputTokens = reasonTokens.outputTokens + (actionTokens?.completionTokens || 0);

  const cost = calculateLLMCost(modelInfo, totalInputTokens, totalOutputTokens);
  if (cost > 0) {
    await deductCredits(organizationId, cost);
  }

  // 如果没有工具调用，继续下一轮对话（让 LLM 继续思考）
  if (!reason.aiMessage?.toolCalls?.length) {
    const observationTime = Date.now() - observationStartTime;

    // 更新消息的 metadata，记录 observationTime
    const currentMessage = await prisma.chatMessages.findUnique({
      where: { id: reason.aiMessage!.id },
      select: { metadata: true },
    });

    const metadata = currentMessage?.metadata || {};
    metadata.timing = {
      ...(metadata.timing || {}),
      observationTime: observationTime,
      roundTime: Date.now() - reason.roundStartTime,
    };

    await prisma.chatMessages.update({
      where: { id: reason.aiMessage!.id },
      data: { metadata: metadata },
    });

    return { completion: null, observationTime };
  }

  // 从完结状态存储中读取完结信息
  const completion = getSessionCompletion(sessionId);

  if (completion) {
    // 标记消息和会话为完成
    await prisma.chatMessages.update({
      where: { id: reason.aiMessage!.id },
      data: {
        isComplete: true,
      },
    });

    // 推送消息完成状态
    // @ts-expect-error - @upstash/realtime 的类型推断问题，schema 中使用了 z.any() 导致类型推断失败
    await realtime.emit('message.update', { sessionId, messageId: reason.aiMessage!.id, data: { isComplete: true } });

    await prisma.chatSessions.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
  }

  // 计算 observation 阶段耗时
  const observationTime = Date.now() - observationStartTime;

  // 更新消息的 metadata，记录 observationTime 和 roundTime
  const currentMessage = await prisma.chatMessages.findUnique({
    where: { id: reason.aiMessage!.id },
    select: { metadata: true },
  });

  const metadata = currentMessage?.metadata || {};
  metadata.timing = {
    ...(metadata.timing || {}),
    observationTime: observationTime,
    roundTime: Date.now() - reason.roundStartTime,
  };

  await prisma.chatMessages.update({
    where: { id: reason.aiMessage!.id },
    data: {
      metadata: metadata,
    },
  });

  return { completion: completion || null, observationTime };
}
