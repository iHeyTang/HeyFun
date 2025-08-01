import type { Chat } from '@repo/llm';

// 简单的工具函数来创建消息，避免重复代码
export const createMessage = {
  user: (content: string): Chat.ChatCompletionMessageParam => ({
    role: 'user',
    content,
  }),

  system: (content: string): Chat.ChatCompletionMessageParam => ({
    role: 'system',
    content,
  }),

  assistant: (content?: string | null, tool_calls?: Chat.ChatCompletionMessageToolCall[]): Chat.ChatCompletionMessageParam => {
    const message: Chat.ChatCompletionMessageParam = {
      role: 'assistant',
      content: content || null,
    };
    if (tool_calls && tool_calls.length > 0) {
      message.tool_calls = tool_calls;
    }
    return message;
  },

  tool: (content: string, tool_call_id: string): Chat.ChatCompletionMessageParam => ({
    role: 'tool',
    content,
    tool_call_id,
  }),
};
