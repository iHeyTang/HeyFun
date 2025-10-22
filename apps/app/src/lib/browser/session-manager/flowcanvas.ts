/**
 * FlowCanvas Session 管理器
 * 专门用于管理 FlowCanvas 项目的 Agent 会话
 */

import {
  createFlowCanvasAgentSession,
  getFlowCanvasAgentSession,
  getFlowCanvasAgentSessions,
  deleteFlowCanvasAgentSession,
} from '@/actions/flowcanvas-agent-session';
import type { SessionManager, ChatSession, ChatMessage, ChatSessionWithMessages } from './types';

/**
 * FlowCanvas Session 管理器实现
 * 为特定的 FlowCanvas 项目管理 Agent 会话
 */
export class FlowCanvasSessionManager implements SessionManager {
  constructor(private projectId: string) {}

  async createSession(params: { modelId: string; title?: string; agentId?: string }): Promise<ChatSession> {
    const result = await createFlowCanvasAgentSession({
      projectId: this.projectId,
      modelId: params.modelId,
      title: params.title,
      agentId: params.agentId,
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
    const result = await getFlowCanvasAgentSession({ sessionId });

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
    await deleteFlowCanvasAgentSession({ sessionId });
  }

  async listSessions(params?: { page?: number; pageSize?: number }): Promise<{ sessions: ChatSession[]; total: number }> {
    const result = await getFlowCanvasAgentSessions({
      projectId: this.projectId,
      ...(params || {}),
    });

    if (!result.data) {
      return { sessions: [], total: 0 };
    }

    const sessions = result.data.sessions.map(s => ({
      id: s.id,
      modelId: s.modelId,
      title: s.title || undefined,
      agentId: s.agentId || undefined,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
    }));

    return {
      sessions,
      total: result.data.total,
    };
  }

  async getSessionWithMessages(sessionId: string): Promise<ChatSessionWithMessages | null> {
    const result = await getFlowCanvasAgentSession({ sessionId });

    if (!result.data) {
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
    let i = 0;

    while (i < rawMessages.length) {
      const msg = rawMessages[i];
      if (!msg) {
        i++;
        continue;
      }

      if (msg.role === 'user' || msg.role === 'assistant') {
        // 普通消息
        const chatMessage: ChatMessage = {
          id: msg.id,
          sessionId: msg.sessionId,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          isStreaming: msg.isStreaming,
          isComplete: msg.isComplete,
          createdAt: new Date(msg.createdAt),
          toolCalls: msg.toolCalls ? (msg.toolCalls as any) : undefined,
        };

        // 查找紧跟在后面的 tool 消息
        const toolResults: any[] = [];
        let j = i + 1;
        while (j < rawMessages.length) {
          const toolMsg = rawMessages[j];
          if (!toolMsg || toolMsg.role !== 'tool') break;

          try {
            const result = JSON.parse(toolMsg.content);
            toolResults.push({
              toolName: result.toolName || 'unknown',
              success: result.success ?? true,
              data: result.data,
              error: result.error,
              message: result.message,
            });
          } catch (e) {
            console.error('Failed to parse tool result:', e);
          }
          j++;
        }

        if (toolResults.length > 0) {
          chatMessage.toolResults = toolResults;
        }

        messages.push(chatMessage);
        i = j; // 跳过已处理的 tool 消息
      } else {
        // 跳过 role='tool' 的消息，它们会被处理为 toolResults
        i++;
      }
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
