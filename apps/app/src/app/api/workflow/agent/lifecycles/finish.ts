/**
 * Workflow 完成与清理逻辑
 */

import { loadModelDefinitionsFromDatabase } from '@/actions/llm';
import { clearSessionCompletion, getSessionCompletion } from '@/agents/tools/context';
import { calculateLLMCost, deductCredits } from '@/lib/server/credit';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { realtime } from '@/lib/realtime';
import { extractJsonFromText } from '@/lib/shared/json';
import CHAT, { UnifiedChat } from '@/llm/chat';

interface FinishParams {
  sessionId: string;
  organizationId: string;
  modelId: string;
}

/**
 * 完成 workflow：处理完结状态 + 清理资源
 */
export async function finishWorkflow(params: FinishParams): Promise<void> {
  const { sessionId, organizationId, modelId } = params;

  // 1. 处理完结状态
  await handleCompletion({ sessionId, organizationId, modelId });

  // 2. 清理资源
  await cleanup({ sessionId, organizationId });
}

/**
 * 处理完结状态（环境变量配置、建议追问等）
 */
async function handleCompletion(params: { sessionId: string; organizationId: string; modelId: string }): Promise<void> {
  const { sessionId, organizationId, modelId } = params;

  const finalCompletionInfo = getSessionCompletion(sessionId);
  if (!finalCompletionInfo) {
    return;
  }

  if (finalCompletionInfo.type === 'configure_environment_variable') {
    // 环境变量配置类型：创建新的消息类型用于前端渲染表单
    const formMessageContent = JSON.stringify({
      type: 'environment_variable_form',
      variables: finalCompletionInfo.params?.variables || [],
      message: finalCompletionInfo.params?.message || '需要配置环境变量',
    });

    await prisma.chatMessages.create({
      data: {
        sessionId,
        organizationId,
        role: 'assistant',
        content: formMessageContent,
        isStreaming: false,
        isComplete: true,
        modelId,
      },
    });

    clearSessionCompletion(sessionId);
  } else if (finalCompletionInfo.type === 'complete') {
    // complete 类型：生成建议追问
    await generateSuggestedQuestions({ sessionId, organizationId, modelId });
    clearSessionCompletion(sessionId);
  } else {
    clearSessionCompletion(sessionId);
  }
}

/**
 * 清理资源（状态更新、中断消息、迭代次数清理）
 */
async function cleanup(params: { sessionId: string; organizationId: string }): Promise<void> {
  const { sessionId, organizationId } = params;

  // 检查是否是中断导致的结束
  const session = await prisma.chatSessions.findUnique({
    where: { id: sessionId },
    select: { status: true },
  });

  const isCancelled = session?.status === 'cancelling';

  // 如果是中断，插入中断消息
  if (isCancelled) {
    // 标记最后一条未完成的消息为完成（不修改内容）
    const lastMessage = await prisma.chatMessages.findFirst({
      where: {
        sessionId,
        role: 'assistant',
        isComplete: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastMessage) {
      await prisma.chatMessages.update({
        where: { id: lastMessage.id },
        data: {
          isComplete: true,
          isStreaming: false,
        },
      });
    }

    // 创建一条新的中断消息，表明中断源
    await prisma.chatMessages.create({
      data: {
        sessionId,
        organizationId,
        role: 'assistant',
        content: JSON.stringify({ type: 'cancel', origin: 'user' }),
        isComplete: true,
        isStreaming: false,
      },
    });
  }

  // 更新状态：processing/cancelling -> idle
  await prisma.chatSessions.update({
    where: { id: sessionId },
    data: {
      status: 'idle',
      updatedAt: new Date(),
    },
  });

  // 推送会话状态更新
  // @ts-expect-error - @upstash/realtime 的类型推断问题
  await realtime.emit('session.status', { sessionId, status: 'idle' }).catch((err: unknown) => {
    console.error(`[Workflow] Failed to emit session.status (idle):`, err);
  });

  // 清理迭代次数
  const iterationKey = `agent-iteration:${sessionId}`;
  await redis.del(iterationKey).catch(err => {
    console.error(`[Workflow] Failed to cleanup iteration count:`, err);
  });
}

/**
 * 生成建议追问
 */
async function generateSuggestedQuestions(params: { sessionId: string; organizationId: string; modelId: string }): Promise<void> {
  const { sessionId, organizationId, modelId } = params;

  try {
    const session = await prisma.chatSessions.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          where: { isComplete: true },
          orderBy: { createdAt: 'asc' },
          take: 10,
        },
      },
    });

    if (!session || session.messages.length === 0) {
      return;
    }

    const allMessages = session.messages.filter(msg => msg.role === 'assistant');
    const lastMessages = allMessages.slice(-5);

    if (lastMessages.length === 0) {
      return;
    }

    const recentMessagesContent = lastMessages
      .map((msg, index) => {
        const messageNum = lastMessages.length - 5 + index + 1;
        return `[消息 ${messageNum}]\n${msg.content || ''}`;
      })
      .join('\n\n---\n\n');

    const suggestionPrompt = `以下是 Agent 最近的回复消息（共${lastMessages.length}条，从旧到新）：

"""
${recentMessagesContent}
"""

请站在**用户的角度**，基于 Agent 的回复内容，生成3-5个**用户想要继续问 Agent 的问题**。

重要要求：
1. **必须站在用户角度**：生成的是用户想问的问题，不是 Agent 问用户的问题
2. **基于 Agent 的回复**：问题应该基于 Agent 最后几条回复的内容，用户想要深入了解或继续探索的方向
3. 如果 Agent 提供了信息或方案，生成用户可能想要问的扩展问题（更多细节、相关案例、实际应用、替代方案等）
4. 如果 Agent 在解释概念，生成用户可能想要深入理解的问题（原理、应用场景、优缺点、相关概念等）
5. 如果 Agent 提供了代码，生成用户可能想要问的代码相关问题（如何优化、错误排查、功能扩展、最佳实践等）
6. 如果 Agent 做了总结，生成用户可能想要深入探索的问题（更多细节、相关案例、实际应用等）
7. 问题应该简洁明了，每个问题不超过20个字，语气自然，像用户在提问
8. 返回JSON格式的数组，例如：["问题1", "问题2", "问题3"]
9. 只返回JSON数组，不要包含其他文字说明

请直接返回JSON数组：`;

    const allModels = await loadModelDefinitionsFromDatabase();
    CHAT.setModels(allModels);

    // 尝试使用的内置小模型ID列表（按优先级）
    const preferredSmallModelIds = ['openai/gpt-5-mini'];
    let smallModelId: string | null = null;

    for (const preferredModelId of preferredSmallModelIds) {
      if (allModels.find(m => m.id === preferredModelId)) {
        smallModelId = preferredModelId;
        break;
      }
    }

    if (!smallModelId) {
      console.warn('[Workflow] 未找到小模型，使用原模型生成建议追问');
      smallModelId = modelId;
    }

    const llmClient = CHAT.createClient(smallModelId);
    const suggestionMessages: UnifiedChat.Message[] = lastMessages.map(msg => ({
      role: 'assistant',
      content: msg.content || '',
    }));
    suggestionMessages.push({ role: 'user', content: suggestionPrompt });

    const suggestionResult = await llmClient.chat({
      messages: suggestionMessages,
      temperature: 0.7,
    });

    const rawContent = suggestionResult.choices[0]?.message?.content;
    let suggestionContent = '';
    if (typeof rawContent === 'string') {
      suggestionContent = rawContent;
    } else if (Array.isArray(rawContent)) {
      suggestionContent = rawContent
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');
    }

    let suggestedQuestions: string[] = [];
    const extractedJson = extractJsonFromText<string[]>(suggestionContent);
    if (extractedJson && Array.isArray(extractedJson) && extractedJson.every((q: unknown) => typeof q === 'string')) {
      suggestedQuestions = extractedJson;
    }

    if (suggestedQuestions.length > 0) {
      const suggestionMessageContent = JSON.stringify({
        type: 'suggested_questions',
        questions: suggestedQuestions,
      });

      await prisma.chatMessages.create({
        data: {
          sessionId,
          organizationId,
          role: 'assistant',
          content: suggestionMessageContent,
          isStreaming: false,
          isComplete: true,
          modelId: smallModelId,
        },
      });

      // 计算并扣除credits
      const modelInfo = allModels.find(m => m.id === smallModelId);
      if (modelInfo) {
        const inputTokens = suggestionResult.usage?.prompt_tokens || 0;
        const outputTokens = suggestionResult.usage?.completion_tokens || 0;
        const cost = calculateLLMCost(modelInfo, inputTokens, outputTokens);
        if (cost > 0) {
          await deductCredits(organizationId, cost);
        }
      }
    }
  } catch (error) {
    console.error('[Workflow] Failed to generate suggested questions:', error);
  }
}
