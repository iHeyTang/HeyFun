import type { UnifiedChat } from '@repo/llm/chat';

// 简单的工具函数来创建消息，避免重复代码
export const createMessage = {
  user: (content: string): UnifiedChat.Message => ({
    role: 'user',
    content,
  }),

  system: (content: string): UnifiedChat.Message => ({
    role: 'system',
    content,
  }),

  assistant: (content?: UnifiedChat.MessageContent | null, tool_calls?: UnifiedChat.ToolCall[]): UnifiedChat.Message => {
    const message: UnifiedChat.Message = {
      role: 'assistant',
      content: content || '',
    };
    if (tool_calls && tool_calls.length > 0) {
      message.tool_calls = tool_calls;
    }
    return message;
  },

  tool: (content: string, tool_call_id: string): UnifiedChat.Message => ({
    role: 'tool',
    content,
    tool_call_id,
  }),
};
