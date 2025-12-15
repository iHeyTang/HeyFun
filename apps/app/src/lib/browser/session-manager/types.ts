/**
 * Session 管理器类型定义
 * 定义 Session 管理的统一接口，支持多种存储方式
 */

export interface ChatSession {
  id: string;
  title?: string | null;
  agentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  isComplete: boolean;
  createdAt: Date;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  modelId?: string; // 模型ID（仅用于assistant消息，标识该消息由哪个模型生成）
}

/**
 * 包含消息的完整 Session
 */
export interface ChatSessionWithMessages extends ChatSession {
  messages: ChatMessage[];
}

/**
 * Session 管理器接口
 * 定义了 Session 生命周期管理的统一接口
 */
export interface SessionManager {
  /**
   * 创建新会话
   */
  createSession(params: { title?: string; agentId?: string }): Promise<ChatSession>;

  /**
   * 获取会话
   */
  getSession(sessionId: string): Promise<ChatSession | null>;

  /**
   * 获取会话及其消息
   */
  getSessionWithMessages(sessionId: string): Promise<ChatSessionWithMessages | null>;

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * 获取会话列表
   */
  listSessions(params?: { page?: number; pageSize?: number }): Promise<{ sessions: ChatSession[]; total: number }>;

  /**
   * 获取会话的消息列表
   */
  getMessages(sessionId: string): Promise<ChatMessage[]>;
}
