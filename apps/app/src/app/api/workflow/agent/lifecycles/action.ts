import { getReactAgentInstance } from '@/agents';
import { ToolResult } from '@/agents/core/tools/tool-definition';
import { toolRegistry } from '@/agents/tools';
import { createCompletionManager, createDynamicSystemPromptManager, createToolManager } from '@/agents/tools/context';
import CHAT, { ModelInfo } from '@/llm/chat';
import { prisma } from '@/lib/server/prisma';
import { realtime } from '@/lib/realtime';
import { saveToolResultsToMessage } from '@/agents/utils';
import { ReasonResult } from './reason';
import { AgentConfig, getBuiltinToolNames } from '@/agents/core/frameworks/base';
import { PrepareResult } from './prepare';

/**
 * 工具执行上下文
 * 注意：不再包含 workflow，所有工具直接执行
 */
export interface ToolExecutionContext {
  organizationId: string;
  sessionId: string;
  toolCallId?: string;
  /** LLM 客户端，用于工具内部调用模型能力 */
  modelId: string;
  /** 当前 ReactAgent 实例，用于动态添加工具 */
  agentId?: string | null;
}

/**
 * 工具执行结果，包含 token 使用情况
 */
export interface ToolExecutionResult {
  results: ToolResult[];
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 工具执行后处理逻辑
 */
export type AfterToolExecutionHandler = (
  params: { reason: ReasonResult; startTime: number },
  result: ToolExecutionResult,
  context: ToolExecutionContext,
) => Promise<void>;

export const afterToolExecutionHandler: AfterToolExecutionHandler = async (params, result, context) => {
  const { reason, startTime } = params;
  const toolCalls = reason.aiMessage?.toolCalls ?? [];
  const messageId = reason.aiMessage?.id ?? '';
  // 步骤11: 保存服务端工具结果到 assistant 消息的 toolResults 字段
  await saveToolResultsToMessage(messageId, toolCalls, result.results);

  // 步骤12: 更新消息的 token 计数（扣费统一在 observe 阶段执行）
  if (result.tokenUsage) {
    const toolInputTokens = result.tokenUsage.promptTokens;
    const toolOutputTokens = result.tokenUsage.completionTokens;

    const currentMessage = await prisma.chatMessages.findUnique({
      where: { id: messageId },
      select: { inputTokens: true, outputTokens: true, tokenCount: true },
    });

    if (currentMessage) {
      const totalInputTokens = (currentMessage.inputTokens || 0) + toolInputTokens;
      const totalOutputTokens = (currentMessage.outputTokens || 0) + toolOutputTokens;
      const totalTokenCount = (currentMessage.tokenCount || 0) + toolInputTokens + toolOutputTokens;

      await prisma.chatMessages.update({
        where: { id: messageId },
        data: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          tokenCount: totalTokenCount,
        },
      });
    }
  }

  // 计算 action 阶段耗时并更新到数据库
  const actionTime = Date.now() - startTime;
  const currentMessage = await prisma.chatMessages.findUnique({
    where: { id: messageId },
    select: { metadata: true },
  });

  const metadata = currentMessage?.metadata || {};
  metadata.timing = {
    ...(metadata.timing || {}),
    actionTime: actionTime,
  };

  await prisma.chatMessages.update({
    where: { id: messageId },
    data: { metadata: metadata },
  });

  // 推送工具执行后的消息更新
  // @ts-expect-error - @upstash/realtime 的类型推断问题
  await realtime.emit('message.update', {
    sessionId: context.sessionId,
    messageId: messageId,
    data: { metadata: metadata },
  });
};

/**
 * 执行工具调用
 * 使用统一的 toolRegistry 来执行所有工具
 * 如果工具使用了 llmClient，会跟踪并返回 token 使用情况
 *
 * 注意：所有工具直接执行，不再使用 workflow.run
 */
export async function executeAction(
  params: { prepare: PrepareResult; reason: ReasonResult },
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const { prepare, reason } = params;
  const toolCalls = reason.aiMessage?.toolCalls ?? [];
  const messageId = reason.aiMessage?.id ?? '';
  const startTime = Date.now();
  const results: ToolResult[] = [];

  // 为工具创建动态系统提示词管理器
  const dynamicSystemPrompt = createDynamicSystemPromptManager(context.sessionId);

  // 为工具创建工具管理器（传入当前 ReactAgent 实例）
  const agentInstance = getReactAgentInstance(context.agentId || undefined);
  const toolManager = createToolManager(context.sessionId, agentInstance);

  // 为工具创建完结管理器
  const completion = createCompletionManager(context.sessionId);

  CHAT.setModels(prepare.allModels);
  const llmClient = CHAT.createClient(context.modelId);

  for (const toolCall of toolCalls) {
    const toolName = toolCall.function?.name;

    if (!toolName) {
      results.push({
        success: false,
        error: 'Tool name is missing',
      });
      continue;
    }

    // 使用统一的工具注册表执行工具
    let result: ToolResult | null = null;
    if (toolRegistry.has(toolName)) {
      result = await toolRegistry.execute(toolCall, {
        organizationId: context.organizationId,
        sessionId: context.sessionId,
        toolCallId: toolCall.id || context.toolCallId,
        messageId,
        llmClient,
        messages: reason.messages,
        dynamicSystemPrompt,
        toolManager,
        builtinToolNames: getBuiltinToolNames(prepare.agentConfig),
        completion,
      });
    } else {
      // 工具未找到
      const allToolNames = toolRegistry.getAllToolNames();
      result = {
        success: false,
        error: `Tool "${toolName}" is not registered. Available tools: ${allToolNames.join(', ')}`,
      };
    }

    if (result) {
      results.push(result);
    }
  }

  // 计算工具执行期间的 token 使用情况（如果提供了 llmClient）
  let tokenUsage: ToolExecutionResult['tokenUsage'] | undefined;
  if (llmClient) {
    const afterInputTokens = llmClient.totalInputTokens;
    const afterCompletionTokens = llmClient.totalCompletionTokens;
    tokenUsage = {
      promptTokens: afterInputTokens,
      completionTokens: afterCompletionTokens,
      totalTokens: afterInputTokens + afterCompletionTokens,
    };
  }

  const executionResult: ToolExecutionResult = { results, tokenUsage };

  // 执行工具执行后的处理逻辑（保存结果、更新 token、扣除费用等）
  await afterToolExecutionHandler({ reason, startTime }, executionResult, context);

  return executionResult;
}
