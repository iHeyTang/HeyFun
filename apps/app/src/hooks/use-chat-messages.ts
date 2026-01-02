import { create } from 'zustand';
import { ChatMessages } from '@prisma/client';
import { useChatSessionsListStore } from './use-chat-sessions-list';

/**
 * 消息管理 Store
 * 负责消息的获取、更新和同步
 */
interface ChatMessagesState {
  // 每个 session 的消息列表
  sessionMessages: Record<string, ChatMessages[]>;
  // 每个 session 的加载状态（用于发送消息时的 loading）
  sessionLoadingStates: Record<string, boolean>;
}

interface ChatMessagesActions {
  // 获取并更新消息（自动处理状态和标题更新）
  fetchAndUpdateMessages: (params: {
    sessionId: string;
    apiPrefix?: string;
  }) => Promise<{ status: string; shouldContinue: boolean; messages: ChatMessages[] }>;
  // 设置 session 消息
  setSessionMessages: (sessionId: string, messages: ChatMessages[]) => void;
  // 添加消息到 session
  addMessageToSession: (sessionId: string, message: ChatMessages) => void;
  // 清空 session 消息
  clearSessionMessages: (sessionId: string) => void;
  // 设置 session 的加载状态
  setSessionLoading: (sessionId: string, loading: boolean) => void;
  // 处理消息数据（从 API 返回的原始消息转换为处理后的消息）
  processMessages: (rawMessages: ChatMessages[]) => ChatMessages[];
}

type ChatMessagesStore = ChatMessagesState & ChatMessagesActions;

export const useChatMessagesStore = create<ChatMessagesStore>()((set, get) => ({
  // 初始状态
  sessionMessages: {},
  sessionLoadingStates: {},

  // 处理消息数据
  processMessages: rawMessages => {
    const processedMessages: ChatMessages[] = [];
    for (const msg of rawMessages) {
      if (!msg) continue;

      // 跳过 role='tool' 的消息，它们已经作为 toolResults 存储在 assistant 消息中
      if (msg.role === 'tool') {
        continue;
      }

      // 只处理 user 和 assistant 消息
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        continue;
      }

      const chatMessage: ChatMessages = msg;

      // 如果这是一个有 toolCalls 的 assistant 消息，从 toolResults 读取工具结果
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolResults) {
        const toolCalls = msg.toolCalls as any[];
        const toolResults = msg.toolResults as any[];
        const processedToolResults: any[] = [];

        // 处理每个工具结果
        for (const toolResult of toolResults) {
          const toolCallId = toolResult.toolCallId;
          const toolCall = toolCalls.find((tc: any) => tc.id === toolCallId);

          // 提取工具结果数据
          const resultData = {
            toolName: toolCall?.function?.name || 'unknown',
            success: toolResult.success ?? true,
            data: toolResult.data,
            error: toolResult.error,
            message: toolResult.message,
          };

          processedToolResults.push(resultData);
        }

        if (processedToolResults.length > 0) {
          chatMessage.toolResults = processedToolResults;
        }
      }

      processedMessages.push(chatMessage);
    }

    return processedMessages;
  },

  // 获取并更新消息（自动处理状态和标题更新）
  fetchAndUpdateMessages: async ({ sessionId, apiPrefix = '/api/agent' }) => {
    try {
      const url = new URL(`${apiPrefix}/messages`, window.location.origin);
      url.searchParams.set('sessionId', sessionId);
      url.searchParams.set('limit', '100');

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data: { messages: ChatMessages[]; status: string; title: string } = await response.json();
      const rawMessages = data.messages || [];

      // 获取处理状态和标题
      const sessionStatus = data.status || 'idle';
      const sessionTitle = data.title;

      // 自动更新状态和标题到 store
      const { updateSessionStatus, updateSessionTitle } = useChatSessionsListStore.getState();
      updateSessionStatus(sessionId, sessionStatus);
      if (sessionTitle) {
        updateSessionTitle(sessionId, sessionTitle);
      }

      // 处理消息
      const processedMessages = get().processMessages(rawMessages);

      // 更新消息列表
      if (processedMessages.length > 0) {
        const state = get();
        const existingMessages = state.sessionMessages[sessionId] || [];

        // 创建消息映射，以ID为key
        const messageMap = new Map<string, ChatMessages>();
        existingMessages.forEach(msg => messageMap.set(msg.id, msg));

        // 更新或添加消息
        processedMessages.forEach((newMsg: ChatMessages) => {
          const existing = messageMap.get(newMsg.id);
          // 确保 createdAt 是 Date 对象
          const createdAtDate = newMsg.createdAt instanceof Date ? newMsg.createdAt : new Date(newMsg.createdAt);

          if (existing) {
            // 更新现有消息（保留 toolResults 等前端状态）
            messageMap.set(newMsg.id, {
              ...existing,
              ...newMsg,
              createdAt: createdAtDate,
              // 如果新消息有 toolResults，更新它
              toolResults: newMsg.toolResults || existing.toolResults,
              // 如果新消息的 token 字段为 null/undefined，保留现有的 token 值
              // 这样可以避免在 token 还未更新时，用 null 覆盖已有的 token 值
              inputTokens: newMsg.inputTokens ?? existing.inputTokens,
              outputTokens: newMsg.outputTokens ?? existing.outputTokens,
              cachedInputTokens: newMsg.cachedInputTokens ?? existing.cachedInputTokens,
              cachedOutputTokens: newMsg.cachedOutputTokens ?? existing.cachedOutputTokens,
              tokenCount: newMsg.tokenCount ?? existing.tokenCount,
            });
          } else {
            // 添加新消息
            messageMap.set(newMsg.id, {
              ...newMsg,
              createdAt: createdAtDate,
            });
          }
        });

        // 转换为数组并按时间排序
        const sortedMessages = Array.from(messageMap.values()).sort((a, b) => {
          const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
          const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
          return timeA - timeB;
        });

        set(state => ({
          sessionMessages: {
            ...state.sessionMessages,
            [sessionId]: sortedMessages,
          },
        }));

        return {
          status: sessionStatus,
          shouldContinue: sessionStatus === 'pending' || sessionStatus === 'processing',
          messages: sortedMessages,
        };
      }

      // 基于处理状态判断是否继续轮询
      const shouldContinue = sessionStatus === 'pending' || sessionStatus === 'processing';

      // 如果没有新消息，返回现有的消息
      const existingMessages = get().sessionMessages[sessionId] || [];

      return {
        status: sessionStatus,
        shouldContinue,
        messages: existingMessages,
      };
    } catch (error) {
      console.error('[ChatMessages] 获取消息失败:', error);
      // 出错时继续轮询，避免因网络问题导致轮询停止
      return {
        status: 'unknown',
        shouldContinue: true,
        messages: get().sessionMessages[sessionId] || [],
      };
    }
  },

  // 设置 session 消息
  setSessionMessages: (sessionId, messages) => {
    set(state => ({
      sessionMessages: {
        ...state.sessionMessages,
        [sessionId]: messages,
      },
    }));
  },

  // 添加消息到 session
  addMessageToSession: (sessionId, message) => {
    set(state => ({
      sessionMessages: {
        ...state.sessionMessages,
        [sessionId]: [...(state.sessionMessages[sessionId] || []), message],
      },
    }));
  },

  // 清空 session 消息
  clearSessionMessages: sessionId => {
    set(state => ({
      sessionMessages: {
        ...state.sessionMessages,
        [sessionId]: [],
      },
    }));
  },

  // 设置 session 的加载状态
  setSessionLoading: (sessionId, loading) => {
    set(state => ({
      sessionLoadingStates: {
        ...state.sessionLoadingStates,
        [sessionId]: loading,
      },
    }));
  },
}));
