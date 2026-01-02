import { create } from 'zustand';
import { ChatSessions } from '@prisma/client';
import { createChatSession, deleteSession, getChatSession, getChatSessions } from '@/actions/chat';

/**
 * Sessions 列表管理 Store
 * 负责 sessions 的 CRUD 操作和切换
 */
interface ChatSessionsListState {
  // Session 列表
  sessions: ChatSessions[];
  // 当前活动的 session ID
  activeSessionId: string | null;
  // 加载状态
  loading: boolean;
  // 正在加载消息的 session ID 集合
  loadingMessages: Set<string>;
}

interface ChatSessionsListActions {
  // 加载 session 列表
  loadSessions: (options?: {
    loadSessionsFn?: () => Promise<ChatSessions[]>;
    initialSessionId?: string;
    externalSessionId?: string;
  }) => Promise<void>;
  // 创建新 session
  createSession: (options?: { createSessionFn?: () => Promise<ChatSessions>; title?: string }) => Promise<ChatSessions | null>;
  // 删除 session
  deleteSession: (sessionId: string) => Promise<void>;
  // 切换 session
  switchSession: (sessionId: string) => Promise<void>;
  // 更新 session 标题
  updateSessionTitle: (sessionId: string, title: string) => void;
  // 更新 session 状态
  updateSessionStatus: (sessionId: string, status: string) => void;
  // 设置活动的 session ID
  setActiveSessionId: (sessionId: string | null) => void;
  // 标记 session 正在加载消息
  setLoadingMessage: (sessionId: string, loading: boolean) => void;
}

type ChatSessionsListStore = ChatSessionsListState & ChatSessionsListActions;

export const useChatSessionsListStore = create<ChatSessionsListStore>()((set, get) => ({
  // 初始状态
  sessions: [],
  activeSessionId: null,
  loading: true,
  loadingMessages: new Set(),

  // 加载 session 列表
  loadSessions: async options => {
    const { loadSessionsFn, initialSessionId, externalSessionId } = options || {};
    const state = get();
    set({ loading: true });

    try {
      let sessions: ChatSessions[];
      if (loadSessionsFn) {
        sessions = await loadSessionsFn();
      } else {
        const result = await getChatSessions({ page: 1, pageSize: 50 });
        sessions = result.data?.sessions || [];
      }

      set({ sessions });

      // 只有在以下情况才设置 activeSessionId：
      // 1. 当前没有 activeSessionId（初始化）
      // 2. 有 initialSessionId（首次加载时指定）
      // 3. 有 externalSessionId 且与当前 activeSessionId 不同（外部路由变化）
      // 注意：如果用户已经主动切换了 session，不要因为 externalSessionId 存在就覆盖
      if (initialSessionId) {
        // 如果有 initialSessionId，优先使用它（首次加载时指定）
        if (!state.activeSessionId || state.activeSessionId !== initialSessionId) {
          set({ activeSessionId: initialSessionId });
        }
      } else if (externalSessionId) {
        // 如果有 externalSessionId，只有在初始化或与当前不同时才设置
        // 这样可以避免在用户主动切换后，因为 externalSessionId 存在就覆盖
        if (!state.activeSessionId || state.activeSessionId !== externalSessionId) {
          set({ activeSessionId: externalSessionId });
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      set({ loading: false });
    }
  },

  // 创建新 session
  createSession: async options => {
    const { createSessionFn, title } = options || {};

    try {
      let newSession: ChatSessions;
      if (createSessionFn) {
        newSession = await createSessionFn();
      } else {
        const createSessionResult = await createChatSession({
          title: title || 'New Chat',
        });
        if (!createSessionResult.data) {
          throw new Error('Failed to create session');
        }
        newSession = createSessionResult.data;
      }

      set(state => ({
        sessions: [newSession, ...state.sessions],
        activeSessionId: newSession.id,
      }));

      return newSession;
    } catch (error) {
      console.error('Create session error:', error);
      return null;
    }
  },

  // 删除 session
  deleteSession: async sessionId => {
    try {
      await deleteSession({ sessionId });

      const state = get();
      const remaining = state.sessions.filter(s => s.id !== sessionId);

      set({
        sessions: remaining,
        activeSessionId: state.activeSessionId === sessionId ? remaining[0]?.id || null : state.activeSessionId,
      });
    } catch (error) {
      console.error('Delete session error:', error);
      throw error;
    }
  },

  // 切换 session
  switchSession: async sessionId => {
    set({ activeSessionId: sessionId });
  },

  // 更新 session 标题
  updateSessionTitle: (sessionId, title) => {
    set(state => ({
      sessions: state.sessions.map(s => (s.id === sessionId ? { ...s, title } : s)),
    }));
  },

  // 更新 session 状态
  updateSessionStatus: (sessionId, status) => {
    set(state => ({
      sessions: state.sessions.map(s => (s.id === sessionId ? { ...s, status: status as any } : s)),
    }));
  },

  // 设置活动的 session ID
  setActiveSessionId: sessionId => {
    set({ activeSessionId: sessionId });
  },

  // 标记 session 正在加载消息
  setLoadingMessage: (sessionId, loading) => {
    set(state => {
      const next = new Set(state.loadingMessages);
      if (loading) {
        next.add(sessionId);
      } else {
        next.delete(sessionId);
      }
      return { loadingMessages: next };
    });
  },
}));
