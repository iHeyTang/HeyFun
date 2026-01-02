import { ToolResult } from '@/agents/core/tools/tool-definition';
import { toolRegistry } from '@/agents/tools';
import { WorkflowContext } from '@upstash/workflow';
import { UnifiedChat, ChatClient } from '@repo/llm/chat';
import { createDynamicSystemPromptManager, createToolManager } from '@/agents/tools/context';
import { ReactAgent } from '@/agents/core/frameworks/react';

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  organizationId: string;
  sessionId: string;
  messageId: string;
  toolCallId?: string;
  workflow?: WorkflowContext;
  /** LLM 客户端，用于工具内部调用模型能力 */
  llmClient?: ChatClient;
  /** 当前消息历史，用于需要访问对话上下文的工具 */
  messages?: UnifiedChat.Message[];
  /** 当前 ReactAgent 实例，用于动态添加工具 */
  reactAgent?: ReactAgent;
  /** 内置工具名称列表（不参与动态检索） */
  builtinToolNames?: string[];
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
 * 执行工具调用
 * 使用统一的 toolRegistry 来执行所有工具
 * 如果工具使用了 llmClient，会跟踪并返回 token 使用情况
 */
export async function executeTools(toolCalls: UnifiedChat.ToolCall[], context: ToolExecutionContext): Promise<ToolExecutionResult> {
  const results: ToolResult[] = [];

  // 为工具创建动态系统提示词管理器
  const dynamicSystemPrompt = createDynamicSystemPromptManager(context.sessionId);

  // 为工具创建工具管理器（传入当前 ReactAgent 实例）
  const toolManager = createToolManager(context.sessionId, context.reactAgent);

  // 记录工具执行前的 token 计数（如果提供了 llmClient）
  let beforeInputTokens = 0;
  let beforeCompletionTokens = 0;
  if (context.llmClient) {
    beforeInputTokens = context.llmClient.totalInputTokens;
    beforeCompletionTokens = context.llmClient.totalCompletionTokens;
  }

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
        workflow: context.workflow!,
        toolCallId: toolCall.id || context.toolCallId,
        messageId: context.messageId,
        llmClient: context.llmClient,
        messages: context.messages,
        dynamicSystemPrompt,
        toolManager,
        builtinToolNames: context.builtinToolNames,
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
  if (context.llmClient) {
    const afterInputTokens = context.llmClient.totalInputTokens;
    const afterCompletionTokens = context.llmClient.totalCompletionTokens;
    const promptTokens = afterInputTokens - beforeInputTokens;
    const completionTokens = afterCompletionTokens - beforeCompletionTokens;

    if (promptTokens > 0 || completionTokens > 0) {
      tokenUsage = {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      };
    }
  }

  return {
    results,
    tokenUsage,
  };
}
