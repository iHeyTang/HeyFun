/**
 * Agent Workflow
 * 使用 Upstash Workflow 自动执行多轮次对话和工具调用
 */

import { getBuiltinToolNames } from '@/agents/core/frameworks/base';
import { prisma } from '@/lib/server/prisma';
import { serve } from '@upstash/workflow/nextjs';
import type { AgentWorkflowConfig } from './types';
import { executeAction } from './lifecycles/action';
import { finishWorkflow } from './lifecycles/finish';
import { executeObserve } from './lifecycles/observe';
import { prepareWorkflow } from './lifecycles/prepare';
import { executeReason } from './lifecycles/reason';
import redis from '@/lib/server/redis';
import { realtime } from '@/lib/realtime';

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
export const { POST } = serve<AgentWorkflowConfig>(
  async context => {
    const { organizationId, sessionId, userMessageId, modelId, agentId } = context.requestPayload;

    // 最大轮次限制，避免无限循环
    const MAX_ROUNDS = 30;
    let roundCount = 0;

    // 初始化工作流：更新状态、触发标题生成、初始化迭代次数、加载 Agent 配置和模型
    const prepareStageRes = await context.run('prepare', async () => {
      return prepareWorkflow({ sessionId, userMessageId, agentId, modelId, organizationId });
    });

    // // 执行初始化循环的一轮：Reason
    // const initReasonRes = await context.run('init-round-reason', async () => {
    //   return executeReason({
    //     roundCount: 0, // 使用 0 表示初始化轮次
    //     sessionId,
    //     organizationId,
    //     modelId,
    //     agentId,
    //     modelInfo: prepareStageRes.modelInfo,
    //     agentConfig: prepareStageRes.agentConfig,
    //     allModels: prepareStageRes.allModels,
    //     extraMessages: [
    //       {
    //         role: 'user',
    //         content: '这是agent初始化阶段，请调用 initialize_agent 工具来获取特定领域的专业知识和激活相关工具。',
    //       },
    //     ],
    //   });
    // });

    // // 检查初始化循环的结果
    // if (initReasonRes.session?.status === 'processing') {
    //   // 执行工具（直接执行，不再使用 workflow）
    //   if (initReasonRes.aiMessage?.toolCalls?.length) {
    //     const initActionRes = await context.run('init-round-action', async () => {
    //       return executeAction(initReasonRes.aiMessage!.toolCalls!, {
    //         organizationId,
    //         sessionId,
    //         messageId: initReasonRes.aiMessage!.id,
    //         modelId,
    //         allModels: prepareStageRes.allModels,
    //         messages: initReasonRes.messages,
    //         agentId: agentId || undefined,
    //         builtinToolNames: getBuiltinToolNames(prepareStageRes.agentConfig),
    //       });
    //     });

    //     // 观察工具执行结果
    //     await context.run('init-round-observe', async () => {
    //       return executeObserve({
    //         sessionId,
    //         organizationId,
    //         modelInfo: prepareStageRes.modelInfo,
    //         reason: initReasonRes,
    //         action: initActionRes,
    //       });
    //     });
    //   }

    //   // 删除初始化循环中创建的 AI 消息（保持消息历史整洁）
    //   // 注意：临时用户消息没有持久化，所以不需要删除
    //   await context.run('init-cleanup', async () => {
    //     if (initReasonRes.aiMessage) {
    //       await prisma.chatMessages
    //         .delete({
    //           where: { id: initReasonRes.aiMessage.id },
    //         })
    //         .catch(() => {
    //           // 忽略删除失败（可能已经被删除）
    //         });
    //     }
    //   });
    // }

    // 主循环：处理多轮次对话
    while (roundCount < MAX_ROUNDS) {
      roundCount++;

      // Reason: 调用 LLM、更新消息、扣除费用、检查会话状态
      const reasonStageRes = await context.run(`round-${roundCount}-reason`, async () => {
        return executeReason({ prepare: prepareStageRes }, { sessionId, organizationId, modelId, agentId });
      });

      // 如果会话状态不是 processing 或 aiMessage 为 null，说明用户取消了，停止 workflow
      if (reasonStageRes.session?.status !== 'processing' || !reasonStageRes.aiMessage) {
        console.log(
          `[Workflow] Stopping workflow for session ${sessionId} due to cancelled status (status: ${reasonStageRes.session?.status}, aiMessage: ${reasonStageRes.aiMessage ? 'exists' : 'null'})`,
        );
        break;
      }

      // 执行工具（直接执行，不再使用 workflow）
      if (!reasonStageRes.aiMessage) {
        throw new Error('AI message is null, cannot execute tools');
      }
      const actionStageRes = await context.run(`round-${roundCount}-action`, async () => {
        return executeAction({ prepare: prepareStageRes, reason: reasonStageRes }, { sessionId, organizationId, modelId, agentId });
      });

      // Observation: 观察工具执行结果，判定是否完成
      // 这是 ReAct 框架的 Observe 阶段，负责判断任务是否完成，并统一扣费
      const observeStageRes = await context.run(`round-${roundCount}-observe`, async () => {
        return executeObserve(
          { prepare: prepareStageRes, reason: reasonStageRes, action: actionStageRes },
          { sessionId, organizationId, modelId, agentId },
        );
      });

      // 如果任务完成，退出循环
      if (observeStageRes.completion) {
        break;
      }

      // 否则继续下一轮对话（Think -> Act -> Observe）
      continue;
    }

    // 完成 workflow：处理完结状态 + 清理资源
    await context.run('finish', async () => {
      await finishWorkflow({ sessionId, organizationId, modelId });
    });
  },
  {
    retries: 0,
    failureFunction: async failureData => {
      console.error(`[Workflow] Error:`, failureData.failResponse);
      const sessionId = failureData.context.requestPayload.sessionId;
      const iterationKey = `agent-iteration:${sessionId}`;

      // 更新会话状态为 idle
      await prisma.chatSessions.update({
        where: { id: sessionId },
        data: { status: 'idle' },
      });

      // 推送会话状态更新
      // @ts-expect-error - @upstash/realtime 的类型推断问题
      await realtime.emit('session.status', { sessionId, status: 'idle' }).catch((err: unknown) => {
        console.error(`[Workflow] Failed to emit session.status (idle on error):`, err);
      });

      // 清理迭代次数（对话完成）
      await redis.del(iterationKey).catch(err => {
        console.error(`[Workflow] Failed to cleanup iteration count:`, err);
      });
    },
  },
);
