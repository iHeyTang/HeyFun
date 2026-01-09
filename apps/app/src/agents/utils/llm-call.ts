import CHAT, { UnifiedChat, type ModelInfo } from '@/llm/chat';

/**
 * LLM 调用结果
 */
export interface LLMCallResult {
  success: boolean;
  data: {
    content: string;
    toolCalls: UnifiedChat.ToolCall[];
    finishReason: string | null;
  } | null;
  error?: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cachedOutputTokens: number;
}

/**
 * 调用 LLM 并处理流式响应
 */
export async function callLLMWithStream(
  modelId: string,
  allModels: ModelInfo[],
  messages: UnifiedChat.Message[],
  tools?: UnifiedChat.Tool[],
): Promise<LLMCallResult> {
  try {
    // 设置模型和创建客户端
    CHAT.setModels(allModels);
    const llmClient = CHAT.createClient(modelId);

    const chatParams: UnifiedChat.ChatCompletionParams = {
      messages,
      ...(tools &&
        tools.length > 0 && {
          tools,
          tool_choice: 'auto' as const,
        }),
    };

    let inputTokens = 0;
    let outputTokens = 0;
    let cachedInputTokens = 0;
    let cachedOutputTokens = 0;
    let fullContent = '';
    const toolCalls: UnifiedChat.ToolCall[] = [];
    let finishReason: string | null = null;

    const stream = llmClient.chatStream(chatParams);

    for await (const chunk of stream) {
      if (chunk.usage) {
        inputTokens += chunk.usage.prompt_tokens || 0;
        outputTokens += chunk.usage.completion_tokens || 0;
        cachedInputTokens += chunk.usage.cached_prompt_tokens || 0;
        cachedOutputTokens += chunk.usage.cached_completion_tokens || 0;
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;

      if (choice.delta?.content) {
        fullContent += choice.delta.content;
      }

      if (choice.delta?.tool_calls) {
        for (const toolCall of choice.delta.tool_calls) {
          const toolCallWithIndex = toolCall as UnifiedChat.ToolCall & { index?: number };
          const index = toolCallWithIndex.index ?? 0;
          if (!toolCalls[index]) {
            toolCalls[index] = {
              id: toolCallWithIndex.id || `tool_${index}`,
              type: toolCallWithIndex.type || 'function',
              function: {
                name: toolCallWithIndex.function?.name || '',
                arguments: toolCallWithIndex.function?.arguments || '',
              },
            };
          } else {
            if (toolCallWithIndex.function?.name) {
              toolCalls[index].function.name = toolCallWithIndex.function.name;
            }
            if (toolCallWithIndex.function?.arguments) {
              toolCalls[index].function.arguments += toolCallWithIndex.function.arguments;
            }
          }
        }
      }

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
        break;
      }
    }

    return {
      success: true,
      data: {
        content: fullContent,
        toolCalls: finishReason === 'tool_calls' ? toolCalls.filter(tc => tc) : [],
        finishReason,
      },
      inputTokens,
      outputTokens,
      cachedInputTokens,
      cachedOutputTokens,
    };
  } catch (error) {
    // 捕获错误，返回错误信息而不是抛出异常
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AgentUtils] LLM call error:`, error);
    return {
      success: false,
      error: errorMessage,
      data: null,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      cachedOutputTokens: 0,
    };
  }
}
