/**
 * Agent Session 管理器
 * 专门用于管理通用 Agent 会话，默认使用 'general' agentId
 */

import { createChatSession, getChatSession, getChatSessions, deleteSession } from '@/actions/chat';
import type { SessionManager, ChatSession, ChatMessage, ChatSessionWithMessages } from './types';

/**
 * Agent Session 管理器实现
 * 为通用 Agent 管理会话，默认使用 'general' agentId
 */
export class AgentSessionManager implements SessionManager {
  constructor(private defaultAgentId: string = 'general') {}

  async createSession(params: { modelId: string; title?: string; agentId?: string }): Promise<ChatSession> {
    const result = await createChatSession({
      ...params,
      agentId: params.agentId || this.defaultAgentId,
    });

    if (!result.data) {
      throw new Error('Failed to create session');
    }

    return {
      id: result.data.id,
      modelId: result.data.modelId,
      title: result.data.title || undefined,
      agentId: result.data.agentId || undefined,
      createdAt: new Date(result.data.createdAt),
      updatedAt: new Date(result.data.updatedAt),
    };
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const result = await getChatSession({ sessionId });

    if (!result.data) {
      return null;
    }

    return {
      id: result.data.id,
      modelId: result.data.modelId,
      title: result.data.title || undefined,
      agentId: result.data.agentId || undefined,
      createdAt: new Date(result.data.createdAt),
      updatedAt: new Date(result.data.updatedAt),
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    await deleteSession({ sessionId });
  }

  async listSessions(params?: { page?: number; pageSize?: number }): Promise<{ sessions: ChatSession[]; total: number }> {
    const result = await getChatSessions(params || {});

    if (!result.data) {
      return { sessions: [], total: 0 };
    }

    // 只返回使用当前 agentId 的会话
    const sessions = result.data.sessions
      .filter(s => s.agentId === this.defaultAgentId)
      .map(s => ({
        id: s.id,
        modelId: s.modelId,
        title: s.title || undefined,
        agentId: s.agentId || undefined,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      }));

    return {
      sessions,
      total: sessions.length,
    };
  }

  async getSessionWithMessages(sessionId: string): Promise<ChatSessionWithMessages | null> {
    const result = await getChatSession({ sessionId });

    if (!result.data) {
      return null;
    }

    // 验证 session 是否属于当前 agent
    if (result.data.agentId !== this.defaultAgentId) {
      return null;
    }

    const session: ChatSession = {
      id: result.data.id,
      modelId: result.data.modelId,
      title: result.data.title || null,
      agentId: result.data.agentId || null,
      createdAt: new Date(result.data.createdAt),
      updatedAt: new Date(result.data.updatedAt),
    };

    // 处理消息，将 role='tool' 的消息转换为 toolResults
    const rawMessages = result.data.messages || [];
    const messages: ChatMessage[] = [];

    for (let i = 0; i < rawMessages.length; i++) {
      const msg = rawMessages[i];
      if (!msg) continue;

      // 跳过 role='tool' 的消息，它们会被处理为 toolResults
      if (msg.role === 'tool') {
        continue;
      }

      const chatMessage: ChatMessage = {
        id: msg.id,
        sessionId: msg.sessionId,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        isStreaming: msg.isStreaming || false,
        isComplete: msg.isComplete,
        createdAt: new Date(msg.createdAt),
        toolCalls: msg.toolCalls ? (msg.toolCalls as any[]) : undefined,
      };

      // 如果这是一个有 toolCalls 的 assistant 消息，查找后续的 tool 消息
      if (msg.role === 'assistant' && msg.toolCalls) {
        const toolCalls = msg.toolCalls as any[];
        const toolResults: any[] = [];

        // 查找所有后续的 tool 消息
        for (let j = i + 1; j < rawMessages.length; j++) {
          const nextMsg = rawMessages[j];
          if (!nextMsg || nextMsg.role !== 'tool') break;

          // 解析工具结果内容
          try {
            const resultData = JSON.parse(nextMsg.content);
            const toolCall = toolCalls.find((tc: any) => tc.id === nextMsg.toolCallId);

            toolResults.push({
              toolName: toolCall?.function?.name || 'unknown',
              success: resultData.success ?? true,
              data: resultData.data,
              error: resultData.error,
              message: resultData.message,
            });
          } catch (e) {
            console.error('Failed to parse tool result:', e);
          }
        }

        if (toolResults.length > 0) {
          chatMessage.toolResults = toolResults;
        }
      }

      messages.push(chatMessage);
    }

    return {
      ...session,
      messages,
    };
  }

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const sessionWithMessages = await this.getSessionWithMessages(sessionId);
    return sessionWithMessages?.messages || [];
  }
}

