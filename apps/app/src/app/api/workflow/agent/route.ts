/**
 * Agent Workflow
 * 使用 Upstash Workflow 自动执行多轮次对话和工具调用
 */

import { loadModelDefinitionsFromDatabase } from '@/actions/llm';
import { getAgent, getAgentInstance } from '@/agents';
import { getBuiltinToolNames } from '@/agents/core/frameworks/base';
import { ReactAgent, type IterationProvider } from '@/agents/core/frameworks/react';
import { buildSystemPrompt } from '@/agents/core/system-prompt';
import { convertPrismaMessagesToUnifiedChat, executeTools, filterReadyChatMessages, saveToolResultsToMessage } from '@/agents/utils';
import { calculateLLMCost, checkCreditsBalance, deductCredits } from '@/lib/server/credit';
import { prisma } from '@/lib/server/prisma';
import { queue } from '@/lib/server/queue';
import { redis } from '@/lib/server/redis';
import CHAT, { UnifiedChat } from '@repo/llm/chat';
import { serve } from '@upstash/workflow/nextjs';

interface AgentWorkflowConfig {
  organizationId: string;
  sessionId: string;
  userMessageId: string;
  modelId: string;
  agentId?: string | null;
}

export const { POST } = serve<AgentWorkflowConfig>(
  async context => {
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

    // 加载 Agent 配置和模型
    const { modelInfo, agentConfig, allModels } = await context.run('load-agent-and-models', async () => {
      const [agentConfig, allModels] = await Promise.all([getAgent(agentId || undefined), loadModelDefinitionsFromDatabase()]);
      const modelInfo = allModels.find(m => m.id === modelId);
      if (!modelInfo) {
        throw new Error(`Model ${modelId} not found`);
      }
      return { modelInfo, agentConfig, allModels };
    });

    CHAT.setModels(allModels);
    const llmClient = CHAT.createClient(modelId);
    const agentInstance = getAgentInstance(agentId || undefined) as unknown as ReactAgent;

    // 主循环：处理多轮次对话
    while (roundCount < MAX_ROUNDS) {
      roundCount++;

      // 步骤1：获取会话和消息历史
      const session = await context.run(`round-${roundCount}-load-session`, async () => {
        const session = await prisma.chatSessions.findUnique({
          where: { id: sessionId, organizationId },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
        });

        if (!session) {
          throw new Error('Session not found');
        }
        if (session.status !== 'processing') {
          throw new Error(`Session ${sessionId} status is ${session.status}, stopping workflow`);
        }

        return session;
      });

      // 步骤2：检查余额
      await context.run(`round-${roundCount}-check-balance`, async () => {
        const estimatedOutputTokens = 1000;
        const estimatedCost = calculateLLMCost(modelInfo, 0, estimatedOutputTokens);
        const hasBalance = await checkCreditsBalance(organizationId, estimatedCost);
        if (!hasBalance) {
          throw new Error('Insufficient balance');
        }
      });

      // 步骤3：构建消息历史
      const messages = await context.run(`round-${roundCount}-build-messages`, async () => {
        const readyMessages = filterReadyChatMessages(session.messages);
        const systemPrompt = buildSystemPrompt({ preset: agentConfig.promptBlocks, framework: [], dynamic: [] });
        return await convertPrismaMessagesToUnifiedChat(readyMessages, organizationId, systemPrompt);
      });

      // 步骤4：创建 AI 消息占位
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

      // 步骤5：再次检查会话是否已被中断（在 LLM 调用前）
      await context.run(`round-${roundCount}-check-session`, async () => {
        const currentSession = await prisma.chatSessions.findUnique({ where: { id: sessionId } });
        if (currentSession?.status !== 'processing') {
          throw new Error(`Session ${sessionId} status is ${currentSession?.status}, stopping workflow`);
        }
      });

      // 步骤6：调用 LLM
      const llmResult = await context.run(`round-${roundCount}-call-llm`, async () => {
        // 使用 ReactAgent.stream（支持微代理）
        CHAT.setModels(allModels);
        const llmClient = CHAT.createClient(modelId);

        let fullContent = '';
        const toolCalls: any[] = [];
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

        const stream = agentInstance.reason(llmClient, agentInstance.getNextStepPrompt(), messages, { modelId, sessionId, iterationProvider });

        for await (const chunk of stream) {
          // 处理文本内容
          if (chunk.type === 'content' && chunk.content) {
            fullContent += chunk.content;
          }

          // 处理工具调用
          if (chunk.type === 'tool_call' && chunk.toolCall) {
            const toolCall = chunk.toolCall;
            // 从 tool_call chunk 中提取工具调用信息
            if (!toolCalls.find(tc => tc.id === toolCall.id)) {
              // 处理 arguments，确保是字符串格式
              let argumentsStr: string;
              const args = toolCall.function.arguments;
              if (typeof args === 'string') {
                // 检查是否是 "[object Object]" 这种错误转换
                if (args === '[object Object]') {
                  console.error(`[Workflow] Tool ${toolCall.function.name} has invalid arguments: "[object Object]"`);
                  argumentsStr = JSON.stringify({});
                } else {
                  // 检查是否是有效的 JSON
                  try {
                    JSON.parse(args);
                    argumentsStr = args;
                  } catch {
                    // 如果不是有效的 JSON，当作空对象处理
                    console.error(`[Workflow] Tool ${toolCall.function.name} has invalid JSON string in arguments:`, args);
                    argumentsStr = JSON.stringify({});
                  }
                }
              } else if (typeof args === 'object' && args !== null) {
                // 如果是对象，序列化为 JSON 字符串
                argumentsStr = JSON.stringify(args);
              } else {
                // 其他情况（null、undefined 等），使用空对象
                argumentsStr = JSON.stringify({});
              }

              toolCalls.push({
                id: toolCall.id || `tool_${toolCalls.length}`,
                type: 'function',
                function: {
                  name: toolCall.function.name,
                  arguments: argumentsStr,
                },
              });
            }
          }

          // 处理 token 使用情况
          if (chunk.type === 'token_usage' && chunk.tokenUsage) {
            inputTokens += chunk.tokenUsage.promptTokens || 0;
            outputTokens += chunk.tokenUsage.completionTokens || 0;
          }
        }

        // 步骤6（Reason）只负责收集 LLM 响应，不做任何判定
        return {
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
      });

      // 步骤7：更新 AI 消息
      await context.run(`round-${roundCount}-update-ai-message`, async () => {
        const { data, inputTokens, outputTokens, cachedInputTokens, cachedOutputTokens } = llmResult;

        await prisma.chatMessages.update({
          where: { id: aiMessage.id },
          data: {
            content: data.content,
            isComplete: false, // 只有调用了 complete 工具才会设置为 true（在步骤13中处理）
            toolCalls: data.toolCalls.length > 0 ? data.toolCalls : undefined,
            tokenCount: inputTokens + outputTokens,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            cachedInputTokens: cachedInputTokens > 0 ? cachedInputTokens : null,
            cachedOutputTokens: cachedOutputTokens > 0 ? cachedOutputTokens : null,
          },
        });
      });

      // 步骤8：扣除费用
      await context.run(`round-${roundCount}-deduct-credits`, async () => {
        const cost = calculateLLMCost(modelInfo, llmResult.inputTokens, llmResult.outputTokens);
        if (cost > 0) {
          await deductCredits(organizationId, cost);
        }
      });

      // 步骤9: 再次检查会话是否已被中断
      await context.run(`round-${roundCount}-check-session`, async () => {
        const currentSession = await prisma.chatSessions.findUnique({ where: { id: sessionId } });
        if (currentSession?.status !== 'processing') {
          throw new Error(`Session ${sessionId} status is ${currentSession?.status}, stopping workflow`);
        }
      });

      // 步骤10: 执行工具
      const toolExecutionResult = await executeTools(llmResult.data.toolCalls, {
        organizationId,
        sessionId,
        workflow: context,
        messageId: aiMessage.id,
        llmClient,
        messages,
        reactAgent: agentInstance,
        builtinToolNames: getBuiltinToolNames(agentConfig),
      });

      // 步骤11: 保存服务端工具结果到 assistant 消息的 toolResults 字段
      await context.run(`round-${roundCount}-save-server-tool-results`, async () => {
        await saveToolResultsToMessage(aiMessage.id, llmResult.data.toolCalls, toolExecutionResult.results);
      });

      // 步骤12: 更新消息的 token 计数，包含工具执行的 token，并扣除费用
      await context.run(`round-${roundCount}-update-tool-tokens`, async () => {
        let toolInputTokens = 0;
        let toolOutputTokens = 0;
        if (toolExecutionResult.tokenUsage) {
          toolInputTokens = toolExecutionResult.tokenUsage.promptTokens;
          toolOutputTokens = toolExecutionResult.tokenUsage.completionTokens;

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
          // 扣除工具执行产生的费用
          const toolCost = calculateLLMCost(modelInfo, toolInputTokens, toolOutputTokens);
          if (toolCost > 0) {
            await deductCredits(organizationId, toolCost);
          }
        }
      });

      // 步骤13（Observation）: 观察工具执行结果，判定是否完成
      // 这是 ReAct 框架的 Observe 阶段，负责判断任务是否完成
      const shouldComplete = await context.run(`round-${roundCount}-observe`, async () => {
        // 如果没有工具调用，继续下一轮对话（让 LLM 继续思考）
        if (!llmResult.data.toolCalls.length) {
          return false;
        }

        // 检查是否调用了 complete 工具
        const hasCompleteTask = llmResult.data.toolCalls.some(tc => tc.function?.name === 'complete');

        if (hasCompleteTask) {
          // 标记消息和会话为完成
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
        }

        return hasCompleteTask;
      });

      // 如果任务完成，退出循环
      if (shouldComplete) {
        break;
      }

      // 否则继续下一轮对话（Think -> Act -> Observe）
      continue;
    }

    // 生成建议追问
    await context.run('generate-suggested-questions', async () => {
      try {
        // 获取会话和消息历史
        const session = await prisma.chatSessions.findUnique({
          where: { id: sessionId },
          include: {
            messages: {
              where: { isComplete: true },
              orderBy: { createdAt: 'asc' },
              take: 10, // 只取最近10条消息用于生成建议追问
            },
          },
        });

        if (!session || session.messages.length === 0) {
          return;
        }

        // 构建消息历史用于生成建议追问
        const readyMessages = filterReadyChatMessages(session.messages);
        const messages = await convertPrismaMessagesToUnifiedChat(readyMessages, organizationId);

        // 构建生成建议追问的提示词
        const suggestionPrompt = `基于以上对话内容，生成3-5个用户可能想要继续追问的问题。要求：
1. 问题应该与对话内容相关，能够帮助用户深入了解或继续探索
2. 问题应该简洁明了，每个问题不超过20个字
3. 返回JSON格式的数组，例如：["问题1", "问题2", "问题3"]
4. 只返回JSON数组，不要包含其他文字说明

请直接返回JSON数组：`;

        // 调用LLM生成建议追问
        const allModels = await loadModelDefinitionsFromDatabase();
        CHAT.setModels(allModels);
        const llmClient = CHAT.createClient(modelId);

        const suggestionMessages: UnifiedChat.Message[] = [
          ...messages,
          { role: 'user', content: suggestionPrompt },
        ];

        const suggestionResult = await llmClient.chat({
          messages: suggestionMessages,
          temperature: 0.7,
        });

        // 处理MessageContent可能是字符串或数组的情况
        const rawContent = suggestionResult.choices[0]?.message?.content;
        let suggestionContent = '';
        if (typeof rawContent === 'string') {
          suggestionContent = rawContent;
        } else if (Array.isArray(rawContent)) {
          // 如果是数组，提取所有文本内容
          suggestionContent = rawContent
            .filter(item => item.type === 'text')
            .map(item => (item as { type: 'text'; text: string }).text)
            .join('\n');
        }

        // 尝试解析JSON数组
        let suggestedQuestions: string[] = [];
        try {
          // 尝试提取JSON数组（可能包含markdown代码块）
          const jsonMatch = suggestionContent.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            suggestedQuestions = JSON.parse(jsonMatch[0]);
          } else {
            suggestedQuestions = JSON.parse(suggestionContent);
          }

          // 验证是字符串数组
          if (!Array.isArray(suggestedQuestions) || !suggestedQuestions.every((q: any) => typeof q === 'string')) {
            throw new Error('Invalid format');
          }
        } catch (parseError) {
          console.error('[Workflow] Failed to parse suggested questions:', parseError);
          // 如果解析失败，尝试从文本中提取问题
          const lines = suggestionContent.split('\n').filter((line: string) => line.trim());
          suggestedQuestions = lines
            .filter((line: string) => line.trim().length > 0 && line.trim().length < 50)
            .map((line: string) => line.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '').trim())
            .filter((q: string) => q.length > 0)
            .slice(0, 5);
        }

        // 如果成功生成了建议追问，保存为特殊类型的消息
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
              modelId: modelId,
            },
          });

          // 计算并扣除credits
          const modelInfo = allModels.find(m => m.id === modelId);
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
        // 生成建议追问失败不影响主流程，只记录错误
        console.error('[Workflow] Failed to generate suggested questions:', error);
      }
    });

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
  },
  {
    failureFunction: async failureData => {
      console.error(`[Workflow] Error:`, failureData.failResponse);
      const sessionId = failureData.context.requestPayload.sessionId;
      const iterationKey = `agent-iteration:${sessionId}`;

      // 更新会话状态为 idle
      await prisma.chatSessions.update({
        where: { id: sessionId },
        data: { status: 'idle' },
      });

      // 清理迭代次数（对话完成）
      await redis.del(iterationKey).catch(err => {
        console.error(`[Workflow] Failed to cleanup iteration count:`, err);
      });
      return Promise.resolve();
    },
  },
);
