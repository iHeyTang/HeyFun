import { ToolResult } from '@/agents/core/tools/tool-definition';
import { toolRegistry } from '@/agents/tools';
import { WorkflowContext } from '@upstash/workflow';
import CHAT, { UnifiedChat, ChatClient, ModelInfo } from '@/llm/chat';
import { createDynamicSystemPromptManager, createToolManager, createCompletionManager } from '@/agents/tools/context';
import { ReactAgent } from '@/agents/core/frameworks/react';
import { getAgentInstance } from '..';

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
  modelId: string;
  allModels: ModelInfo[];
  /** 当前消息历史，用于需要访问对话上下文的工具 */
  messages?: UnifiedChat.Message[];
  /** 当前 ReactAgent 实例，用于动态添加工具 */
  agentId?: string;
  /** 内置工具名称列表（不参与动态检索） */
  builtinToolNames?: string[];
  /** 工具执行完成后的回调，在 workflow context.run 中执行 */
  afterToolExecution?: (result: ToolExecutionResult, workflowContext: WorkflowContext) => Promise<void>;
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
  const agentInstance = getAgentInstance(context.agentId) as unknown as ReactAgent;
  const toolManager = createToolManager(context.sessionId, agentInstance);

  // 为工具创建完结管理器
  const completion = createCompletionManager(context.sessionId);

  CHAT.setModels(context.allModels);
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
        workflow: context.workflow!,
        toolCallId: toolCall.id || context.toolCallId,
        messageId: context.messageId,
        llmClient,
        messages: context.messages,
        dynamicSystemPrompt,
        toolManager,
        builtinToolNames: context.builtinToolNames,
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

  const executionResult: ToolExecutionResult = {
    results,
    tokenUsage,
  };

  // 如果提供了 afterToolExecution 回调，在 workflow context.run 中执行
  if (context.afterToolExecution && context.workflow) {
    await context.workflow.run(`after-tool-execution-${context.toolCallId}`, async () => {
      await context.afterToolExecution!(executionResult, context.workflow!);
    });
  }

  return executionResult;
}
