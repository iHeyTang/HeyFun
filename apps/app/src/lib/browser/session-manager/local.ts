/**
 * 本地 Session 管理器
 * 使用 localStorage 存储 Session
 */

import type { SessionManager, ChatSession, ChatMessage, ChatSessionWithMessages } from './types';

const STORAGE_KEY_PREFIX = 'chat_sessions_';
const STORAGE_KEY_MESSAGES = 'chat_messages_';

/**
 * 本地 Session 管理器实现
 * Session 数据存储在浏览器 localStorage
 */
export class LocalSessionManager implements SessionManager {
  async createSession(params: { title?: string; agentId?: string }): Promise<ChatSession> {
    const session: ChatSession = {
      id: `local_${Date.now()}`,
      title: params.title,
      agentId: params.agentId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 保存到 localStorage
    const sessions = this.getAllSessions();
    sessions.push(session);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'list', JSON.stringify(sessions));

    return session;
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const sessions = this.getAllSessions();
    return sessions.find(s => s.id === sessionId) || null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const sessions = this.getAllSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'list', JSON.stringify(filtered));

    // 删除消息
    localStorage.removeItem(STORAGE_KEY_MESSAGES + sessionId);
  }

  async listSessions(params?: { page?: number; pageSize?: number }): Promise<{ sessions: ChatSession[]; total: number }> {
    const sessions = this.getAllSessions();
    const { page = 1, pageSize = 20 } = params || {};

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedSessions = sessions.slice(start, end);

    return {
      sessions: paginatedSessions,
      total: sessions.length,
    };
  }

  async getSessionWithMessages(sessionId: string): Promise<ChatSessionWithMessages | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const messages = await this.getMessages(sessionId);

    return {
      ...session,
      messages,
    };
  }

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const stored = localStorage.getItem(STORAGE_KEY_MESSAGES + sessionId);
    if (!stored) {
      return [];
    }

    try {
      const messages = JSON.parse(stored);
      return messages.map((msg: any) => ({
        ...msg,
        createdAt: new Date(msg.createdAt),
      }));
    } catch {
      return [];
    }
  }

  /**
   * 保存消息到 localStorage
   * 这是一个辅助方法，用于在本地模式下保存消息
   */
  async saveMessage(message: ChatMessage): Promise<void> {
    const messages = await this.getMessages(message.sessionId);
    messages.push(message);
    localStorage.setItem(STORAGE_KEY_MESSAGES + message.sessionId, JSON.stringify(messages));
  }

  private getAllSessions(): ChatSession[] {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + 'list');
    if (!stored) {
      return [];
    }

    try {
      const sessions = JSON.parse(stored);
      return sessions.map((s: any) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      }));
    } catch {
      return [];
    }
  }
}
