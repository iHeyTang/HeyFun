/**
 * Stream 处理工具函数
 */

import type { UnifiedChat } from '@/llm/chat';

interface StreamToolCall {
  id?: string;
  function: {
    name: string;
    arguments: string | object;
  };
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'token_usage';
  content?: string;
  toolCall?: StreamToolCall;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface StreamResult {
  fullContent: string;
  toolCalls: UnifiedChat.ToolCall[];
  inputTokens: number;
  outputTokens: number;
}

/**
 * 处理工具调用参数，确保是有效的 JSON 字符串
 */
function normalizeToolArguments(args: unknown): string {
  if (typeof args === 'string') {
    // 检查是否是 "[object Object]" 这种错误转换
    if (args === '[object Object]') {
      console.error(`[Workflow] Tool has invalid arguments: "[object Object]"`);
      return JSON.stringify({});
    }
    // 检查是否是有效的 JSON
    try {
      JSON.parse(args);
      return args;
    } catch {
      // 如果不是有效的 JSON，当作空对象处理
      console.error(`[Workflow] Tool has invalid JSON string in arguments:`, args);
      return JSON.stringify({});
    }
  } else if (typeof args === 'object' && args !== null) {
    // 如果是对象，序列化为 JSON 字符串
    return JSON.stringify(args);
  } else {
    // 其他情况（null、undefined 等），使用空对象
    return JSON.stringify({});
  }
}

/**
 * 处理 stream chunk，提取工具调用信息
 */
export function processToolCallChunk(chunk: StreamChunk, existingToolCalls: UnifiedChat.ToolCall[]): UnifiedChat.ToolCall[] {
  if (chunk.type !== 'tool_call' || !chunk.toolCall) {
    return existingToolCalls;
  }

  const toolCall = chunk.toolCall;
  // 如果已经存在相同 ID 的工具调用，跳过
  if (existingToolCalls.find(tc => tc.id === toolCall.id)) {
    return existingToolCalls;
  }

  const argumentsStr = normalizeToolArguments(toolCall.function.arguments);

  return [
    ...existingToolCalls,
    {
      id: toolCall.id || `tool_${existingToolCalls.length}`,
      type: 'function',
      function: {
        name: toolCall.function.name,
        arguments: argumentsStr,
      },
    },
  ];
}

/**
 * 处理流错误，判断是否是连接中断错误
 */
export function handleStreamError(error: unknown, sessionId: string, messageId: string): { isConnectionError: boolean; shouldContinue: boolean } {
  const errorMessage = error instanceof Error ? error.message : 'Unknown stream error';
  const errorCause = error instanceof Error ? error.cause : undefined;
  const causeCode = errorCause && typeof errorCause === 'object' && 'code' in errorCause ? errorCause.code : undefined;
  const causeMessage =
    errorCause && typeof errorCause === 'object' && 'message' in errorCause && typeof errorCause.message === 'string'
      ? errorCause.message
      : undefined;

  // 检查是否是连接中断错误
  const isConnectionError =
    errorMessage.includes('terminated') ||
    errorMessage.includes('closed') ||
    causeCode === 'UND_ERR_SOCKET' ||
    Boolean(causeMessage && causeMessage.includes('closed'));

  return {
    isConnectionError,
    shouldContinue: !isConnectionError,
  };
}
