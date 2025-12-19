/**
 * Chat Sessions 统一 Hook
 * 组合所有子 store，提供统一的接口
 */

import { useChatSessionsListStore } from './use-chat-sessions-list';
import { useChatMessagesStore } from './use-chat-messages';
import { useChatInputStore } from './use-chat-input';
import { ChatSessions, ChatMessages } from '@prisma/client';
import { ChatInputAttachment } from '@/components/block/chat-input';

/**
 * 统一的 Chat Sessions Hook（用于组件中）
 * 组合所有子 store 的功能
 */
export const useChatSessionsStore = () => {
  const sessionsList = useChatSessionsListStore();
  const messages = useChatMessagesStore();
  const input = useChatInputStore();

  return {
    // Sessions 列表相关
    sessions: sessionsList.sessions,
    activeSessionId: sessionsList.activeSessionId,
    loading: sessionsList.loading,
    loadingMessages: sessionsList.loadingMessages,
    loadSessions: sessionsList.loadSessions,
    createSession: sessionsList.createSession,
    deleteSession: sessionsList.deleteSession,
    switchSession: sessionsList.switchSession,
    updateSessionTitle: sessionsList.updateSessionTitle,
    updateSessionStatus: sessionsList.updateSessionStatus,
    setActiveSessionId: sessionsList.setActiveSessionId,

    // 消息相关
    sessionMessages: messages.sessionMessages,
    sessionLoadingStates: messages.sessionLoadingStates,
    fetchAndUpdateMessages: messages.fetchAndUpdateMessages,
    setSessionMessages: messages.setSessionMessages,
    addMessageToSession: messages.addMessageToSession,
    clearSessionMessages: messages.clearSessionMessages,
    setSessionLoading: messages.setSessionLoading,

    // 输入相关
    sessionInputValues: input.sessionInputValues,
    sessionAttachments: input.sessionAttachments,
    setSessionInputValue: input.setSessionInputValue,
    setSessionAttachments: input.setSessionAttachments,
    hasRealContent: input.hasRealContent,
  };
};

/**
 * 便捷 Hook：获取当前活动的 session 信息
 */
export const useActiveChatSession = () => {
  const sessionsList = useChatSessionsListStore();
  const messages = useChatMessagesStore();
  const input = useChatInputStore();

  const activeSession = sessionsList.sessions.find(s => s.id === sessionsList.activeSessionId);
  const activeMessages = sessionsList.activeSessionId ? messages.sessionMessages[sessionsList.activeSessionId] || [] : [];
  const activeInputValue = sessionsList.activeSessionId ? input.sessionInputValues[sessionsList.activeSessionId] || '' : '';
  const activeAttachments = sessionsList.activeSessionId ? input.sessionAttachments[sessionsList.activeSessionId] || [] : [];

  return {
    session: activeSession,
    sessionId: sessionsList.activeSessionId,
    messages: activeMessages,
    inputValue: activeInputValue,
    attachments: activeAttachments,
    isLoading: sessionsList.loadingMessages.has(sessionsList.activeSessionId || ''),
  };
};

/**
 * 便捷 Hook：获取指定 session 的信息
 */
export const useChatSession = (sessionId: string | null) => {
  const sessionsList = useChatSessionsListStore();
  const messages = useChatMessagesStore();
  const input = useChatInputStore();

  if (!sessionId) {
    return {
      session: null,
      messages: [],
      inputValue: '',
      attachments: [],
      isLoading: false,
    };
  }

  return {
    session: sessionsList.sessions.find(s => s.id === sessionId) || null,
    messages: messages.sessionMessages[sessionId] || [],
    inputValue: input.sessionInputValues[sessionId] || '',
    attachments: input.sessionAttachments[sessionId] || [],
    isLoading: sessionsList.loadingMessages.has(sessionId),
  };
};

// 导出子 store，以便需要单独使用的地方可以直接使用
export { useChatSessionsListStore, useChatMessagesStore, useChatInputStore };

/**
 * Store 对象（用于非 hook 场景，如回调函数中）
 * 提供直接访问 store 的能力，不触发组件重新渲染
 */
export const chatSessionsStore = {
  // 便捷方法：设置消息
  setSessionMessages: (sessionId: string, messages: ChatMessages[]) => {
    useChatMessagesStore.getState().setSessionMessages(sessionId, messages);
  },
};
