import { ChatClient, UnifiedChat } from '@repo/llm/chat';
import type { SystemPromptBlock } from '@/agents/core/system-prompt';

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** Agent 唯一标识 */
  id: string;
  /** Agent 名称 */
  name: string;
  /** Agent 描述 */
  description: string;
  /** Preset 层提示词 Blocks，用于分块组织提示词内容 */
  promptBlocks: SystemPromptBlock[];
  /** Agent 支持的工具列表（内置工具，启动时就有，不参与动态检索） */
  tools: UnifiedChat.Tool[];
  /** Observation 提示词（可选，用于 ReAct 框架的观察阶段，引导 Agent 分析工具结果并继续推理） */
  observationPrompt?: string;
}

/**
 * 从 AgentConfig 的 tools 中提取内置工具名称列表
 */
export function getBuiltinToolNames(config: AgentConfig): string[] {
  return config.tools.map(t => t.function?.name).filter((name): name is string => !!name);
}

/**
 * Agent 接口（内部使用）
 */
export interface IAgent {
  getConfig(): AgentConfig;
}

export abstract class BaseAgent implements IAgent {
  protected abstract config: AgentConfig;

  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * 构建系统提示词（子类实现）
   * @returns 返回两部分：basePrompt（内置，永远不变）和 dynamicPrompt（动态，可选）
   */
  protected abstract buildSystemPrompt(sessionId?: string): Promise<{ basePrompt: string; dynamicPrompt?: string }>;

  /**
   * 调用 LLM 的 chatStream，处理流式响应
   * 只负责 chat 部分，不包含循环逻辑
   */
  async *chatStream(
    llmClient: ChatClient,
    messages: UnifiedChat.Message[],
    dynamicTools: UnifiedChat.Tool[] = [],
    options?: {
      sessionId?: string;
    },
  ): AsyncGenerator<{
    type: 'content' | 'tool_call' | 'token_usage';
    content?: string;
    toolCall?: UnifiedChat.ToolCall;
    tokenUsage?: { promptTokens?: number; completionTokens?: number };
  }> {
    // 构建系统提示词（分为两段：内置 + 动态）
    const { basePrompt, dynamicPrompt } = await this.buildSystemPrompt(options?.sessionId);

    // 处理系统消息：保留第一段（内置），插入或替换第二段（动态）
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const nonSystemMessages = messages.filter(msg => msg.role !== 'system');

    let finalSystemPrompt: string;
    if (systemMessages.length > 0) {
      // 如果已有 system 消息，保留它作为第一段，然后追加或替换第二段
      const existingSystemContent = systemMessages
        .map(msg => (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)))
        .join('\n\n');

      if (dynamicPrompt) {
        // 如果有动态提示词，追加到现有系统提示词后面
        finalSystemPrompt = `${existingSystemContent}\n\n---\n\n${dynamicPrompt}`;
      } else {
        // 如果没有动态提示词，只使用现有的
        finalSystemPrompt = existingSystemContent;
      }
    } else {
      // 如果没有 system 消息，使用完整构建的系统提示词
      if (dynamicPrompt) {
        finalSystemPrompt = `${basePrompt}\n\n---\n\n${dynamicPrompt}`;
      } else {
        finalSystemPrompt = basePrompt;
      }
    }

    const finalMessages: UnifiedChat.Message[] = [{ role: 'system', content: finalSystemPrompt }, ...nonSystemMessages];

    // 验证消息不为空
    if (!finalMessages || finalMessages.length === 0) {
      throw new Error('Cannot call LLM with empty messages array');
    }

    // 验证至少有一条非系统消息
    const hasNonSystemMessage = finalMessages.some(msg => {
      if (msg.role === 'system') return false;
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return content && content.trim().length > 0;
    });

    if (!hasNonSystemMessage) {
      throw new Error('Cannot call LLM without at least one non-system message with content');
    }

    // 合并基础工具和动态添加的工具
    const allTools = [...this.config.tools, ...dynamicTools];

    const chatParams: UnifiedChat.ChatCompletionParams = {
      messages: finalMessages,
      tools: allTools.length > 0 ? allTools : undefined,
      tool_choice: allTools.length > 0 ? 'auto' : undefined,
    };

    const stream = llmClient.chatStream(chatParams);

    let accumulatedContent = '';
    const toolCalls: UnifiedChat.ToolCall[] = [];
    let inputTokens = 0;
    let outputTokens = 0;

    // 处理流式响应
    for await (const chunk of stream) {
      // 累积 token 使用量
      if (chunk.usage) {
        inputTokens += chunk.usage.prompt_tokens || 0;
        outputTokens += chunk.usage.completion_tokens || 0;
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;

      // 处理文本内容
      if (choice.delta?.content) {
        const contentDelta = choice.delta.content;
        accumulatedContent += contentDelta;

        yield {
          type: 'content',
          content: contentDelta,
        };
      }

      // 处理工具调用（累积）
      if (choice.delta?.tool_calls) {
        for (const toolCallDelta of choice.delta.tool_calls) {
          const index = (toolCallDelta as any).index ?? 0;
          if (!toolCalls[index]) {
            toolCalls[index] = {
              id: (toolCallDelta as any).id || `tool_${index}`,
              type: 'function',
              function: {
                name: (toolCallDelta as any).function?.name || '',
                arguments: (toolCallDelta as any).function?.arguments || '',
              },
            };
          } else {
            // 累加 arguments（可能分多次发送）
            if ((toolCallDelta as any).function?.arguments) {
              toolCalls[index].function.arguments += (toolCallDelta as any).function.arguments;
            }
            // 更新 name（某些 provider 可能分多次发送）
            if ((toolCallDelta as any).function?.name) {
              toolCalls[index].function.name = (toolCallDelta as any).function.name;
            }
          }
        }
      }

      // 检查是否完成
      if (choice.finish_reason) {
        const finishReason = choice.finish_reason;

        // 输出工具调用信息
        if (finishReason === 'tool_calls' && toolCalls.length > 0) {
          // 验证 tool calls 的完整性
          const validToolCalls = toolCalls.filter(tc => tc?.id && tc?.function?.name);

          for (const toolCall of validToolCalls) {
            yield {
              type: 'tool_call',
              toolCall,
            };
          }
        }

        // 输出 token 使用情况
        if (inputTokens > 0 || outputTokens > 0) {
          yield {
            type: 'token_usage',
            tokenUsage: {
              promptTokens: inputTokens,
              completionTokens: outputTokens,
            },
          };
        }

        return;
      }
    }
  }
}
