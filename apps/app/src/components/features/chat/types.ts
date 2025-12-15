/**
 * Chat 相关的类型定义
 */

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON 字符串
  };
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  isComplete: boolean;
  createdAt: Date;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  modelId?: string; // 模型ID（仅用于assistant消息，标识该消息由哪个模型生成）
}
