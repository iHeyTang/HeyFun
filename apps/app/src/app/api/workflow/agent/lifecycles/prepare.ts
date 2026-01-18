/**
 * Workflow 初始化准备阶段
 */

import { loadModelDefinitionsFromDatabase } from '@/actions/llm';
import { getAgent } from '@/agents';
import { prisma } from '@/lib/server/prisma';
import { queue } from '@/lib/server/queue';
import { redis } from '@/lib/server/redis';
import { realtime } from '@/lib/realtime';
import { ModelInfo } from '@/llm/chat';
import { AgentConfig } from '@/agents/core/frameworks/base';

interface PrepareParams {
  sessionId: string;
  userMessageId: string;
  agentId?: string | null;
  modelId: string;
  organizationId: string;
}

export interface PrepareResult {
  modelInfo: ModelInfo;
  agentConfig: AgentConfig;
  allModels: ModelInfo[];
}

export async function prepareWorkflow(params: PrepareParams): Promise<PrepareResult> {
  const { sessionId, userMessageId, agentId, modelId, organizationId } = params;

  // 更新状态：pending -> processing（开始执行）
  await prisma.chatSessions.update({
    where: { id: sessionId },
    data: { status: 'processing' },
  });

  // 推送会话状态更新
  // @ts-expect-error - @upstash/realtime 的类型推断问题，schema 中使用了 z.any() 导致类型推断失败
  await realtime.emit('session.status', { sessionId, status: 'processing' }).catch((err: unknown) => {
    console.error(`[Workflow] Failed to emit session.status:`, err);
  });

  // 检查并触发标题生成（如果需要）
  const userMessage = await prisma.chatMessages.findUnique({
    where: { id: userMessageId },
  });

  if (userMessage) {
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
  }

  // 触发异步开启 sandbox（不阻塞主流程）
  // ensureSandbox 具有幂等性，如果已存在则复用
  await queue.publish({ url: '/api/queue/sandbox/create', body: { sessionId } });
  console.log(`[Workflow] Triggered sandbox create for session ${sessionId} at start`);

  // 初始化迭代次数（如果不存在）
  // 注意：这个迭代次数是 ReactAgent 内部的 ReAct 循环迭代次数，不是 workflow 的 roundCount
  const iterationKey = `agent-iteration:${sessionId}`;
  const current = await redis.get<number>(iterationKey);
  if (current === null) {
    await redis.set(iterationKey, 0, { ex: 3600 }); // 1小时过期
  }

  // 加载 Agent 配置和模型
  const [agentConfig, allModels] = await Promise.all([getAgent(agentId || undefined), loadModelDefinitionsFromDatabase()]);
  const modelInfo = allModels.find(m => m.id === modelId);
  if (!modelInfo) {
    throw new Error(`Model ${modelId} not found`);
  }
  return { modelInfo, agentConfig, allModels };
}
