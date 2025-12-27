import { ToolResult } from '@/agents/core/tools/tool-definition';
import { toolRegistry } from '@/agents/tools';
import { WorkflowContext } from '@upstash/workflow';
import { UnifiedChat, ChatClient } from '@repo/llm/chat';
import { createDynamicSystemPromptManager } from '@/agents/tools/context';

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
}

/**
 * 执行工具调用
 * 使用统一的 toolRegistry 来执行所有工具
 */
export async function executeTools(toolCalls: UnifiedChat.ToolCall[], context: ToolExecutionContext): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  // 为工具创建动态系统提示词管理器
  const dynamicSystemPrompt = createDynamicSystemPromptManager(context.sessionId);

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

  return results;
}
