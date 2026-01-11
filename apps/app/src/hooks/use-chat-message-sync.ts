/**
 * Chat Message Sync Hook
 * 统一管理消息同步逻辑，包括 realtime 订阅和 polling
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRealtime } from '@/lib/realtime-client';
import { useChatMessagesStore } from './use-chat-messages';
import { useChatSessionsListStore } from './use-chat-sessions-list';
import { useChatSessionsStore } from './use-chat-sessions';
import { ChatMessages } from '@prisma/client';

interface UseChatMessageSyncOptions {
  /** Session ID */
  sessionId: string;
}

/**
 * Chat Message Sync Hook
 * 统一管理消息同步逻辑：
 * 1. 使用 realtime 订阅实时消息更新
 * 2. 当 session 状态为 pending 或 processing 时，自动启动 polling
 * 3. 当状态变为 idle 或 failed 时，自动停止 polling
 */
export function useChatMessageSync({ sessionId }: UseChatMessageSyncOptions) {
  const { fetchAndUpdateMessages } = useChatMessagesStore();
  const { setSessionLoading } = useChatSessionsStore();

  // Polling 相关的 ref
  const shouldPollRef = useRef<boolean>(false);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const lastMessageIdRef = useRef<string | null>(null);

  // 获取消息并更新状态
  const fetchMessagesRef = useRef<(() => Promise<{ status: string; shouldContinue: boolean }>) | undefined>(undefined);

  const fetchMessages = useCallback(async (): Promise<{ status: string; shouldContinue: boolean }> => {
    // 使用倒数第二条消息作为游标，这样既能获取新消息，也能获取最后一条消息的更新
    const state = useChatMessagesStore.getState();
    const currentMessages = state.sessionMessages[sessionId] || [];

    // 如果有至少 2 条消息，使用倒数第二条消息的 ID 作为游标
    let cursorMessageId: string | undefined;
    if (currentMessages.length >= 2) {
      const secondLastMessage = currentMessages[currentMessages.length - 2];
      if (secondLastMessage && !secondLastMessage.id.startsWith('temp_')) {
        cursorMessageId = secondLastMessage.id;
      }
    } else if (currentMessages.length === 1) {
      // 如果只有一条消息，不传 cursor，获取全量
      cursorMessageId = undefined;
    }

    const result = await fetchAndUpdateMessages({ sessionId, lastMessageId: cursorMessageId });

    // 更新最后一条消息ID（用于下次判断）
    if (result.messages.length > 0) {
      const newLastMessage = result.messages[result.messages.length - 1];
      if (newLastMessage) {
        lastMessageIdRef.current = newLastMessage.id;
      }
    } else if (currentMessages.length > 0) {
      // 如果没有新消息，更新为当前最后一条消息的 ID
      const currentLastMessage = currentMessages[currentMessages.length - 1];
      if (currentLastMessage && !currentLastMessage.id.startsWith('temp_')) {
        lastMessageIdRef.current = currentLastMessage.id;
      }
    }

    return { status: result.status, shouldContinue: result.shouldContinue };
  }, [sessionId, fetchAndUpdateMessages]);

  // 更新 fetchMessages ref - 立即设置，不等待 useEffect
  fetchMessagesRef.current = fetchMessages;

  // 轮询消息（带延时）- 使用 setTimeout 迭代而不是递归
  const scheduleNextPoll = useCallback(() => {
    // 清除之前的 timeout
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }

    // 如果不需要继续轮询，直接返回
    if (!shouldPollRef.current) {
      isPollingRef.current = false;
      return;
    }

    // 调度下一次轮询
    pollingTimeoutRef.current = setTimeout(async () => {
      pollingTimeoutRef.current = null;

      // 再次检查是否应该继续轮询
      if (!shouldPollRef.current) {
        isPollingRef.current = false;
        return;
      }

      // 防止并发执行
      if (isPollingRef.current) {
        console.log('[useChatMessageSync] 轮询正在执行中，跳过本次调用');
        return;
      }

      // 使用 ref 中的最新函数
      const fetchFn = fetchMessagesRef.current;
      if (!fetchFn) {
        isPollingRef.current = false;
        return;
      }

      isPollingRef.current = true;
      try {
        const { status, shouldContinue } = await fetchFn();

        if (!shouldContinue) {
          // 状态为 idle 或 failed，停止轮询
          console.log('[useChatMessageSync] session 状态为', status, '，停止轮询');
          shouldPollRef.current = false;
          setSessionLoading(sessionId, false);
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
          }
          return;
        }

        // 继续轮询，调度下一次
        if (shouldPollRef.current) {
          scheduleNextPoll();
        }
      } finally {
        isPollingRef.current = false;
      }
    }, 3000);
  }, [sessionId, setSessionLoading]);

  // 启动轮询
  const startPolling = useCallback(() => {
    shouldPollRef.current = true;
    scheduleNextPoll();
  }, [scheduleNextPoll]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    shouldPollRef.current = false;
    isPollingRef.current = false;
    setSessionLoading(sessionId, false);
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, [sessionId, setSessionLoading]);

  // 检查状态并启动轮询（如果需要）
  const checkStatusAndStartPolling = useCallback(async () => {
    const fetchFn = fetchMessagesRef.current;
    if (!fetchFn) {
      console.warn('[useChatMessageSync] fetchMessages ref 未设置，无法获取状态');
      setSessionLoading(sessionId, false);
      return;
    }

    const { status, shouldContinue } = await fetchFn();
    console.log('[useChatMessageSync] session 状态:', status, '，应该继续:', shouldContinue);

    if (!shouldContinue) {
      // 如果状态已经是 idle 或 failed，直接停止加载
      console.log('[useChatMessageSync] session 状态为', status, '，无需轮询');
      shouldPollRef.current = false;
      setSessionLoading(sessionId, false);
      return;
    }

    // 状态为 pending 或 processing，开始轮询（带延时）
    console.log('[useChatMessageSync] session 状态为', status, '，开始轮询');
    setSessionLoading(sessionId, true);
    startPolling();
  }, [sessionId, setSessionLoading, startPolling]);

  // Realtime 订阅消息更新
  useRealtime({
    events: ['message.content', 'message.update', 'message.create', 'session.status'],
    channel: `session:${sessionId}`,
    onData({ event, data }) {
      const { updateMessage, addMessageToSession } = useChatMessagesStore.getState();
      const { updateSessionStatus } = useChatSessionsListStore.getState();

      if (event === 'message.content' || event === 'message.update') {
        // 更新消息内容
        const messageId = 'messageId' in data ? data.messageId : '';
        if (messageId) {
          updateMessage(sessionId, messageId, event === 'message.content' ? { content: data.content, isComplete: data.isComplete } : data);
        }
      } else if (event === 'message.create') {
        // 添加新消息
        if ('message' in data && data.message) {
          addMessageToSession(sessionId, data.message as ChatMessages);
        }
      } else if (event === 'session.status') {
        // 更新会话状态
        if ('status' in data) {
          updateSessionStatus(sessionId, data.status);
          // 如果状态变为 idle 或 failed，停止轮询
          if (data.status === 'idle' || data.status === 'failed') {
            shouldPollRef.current = false;
            setSessionLoading(sessionId, false);
          }
        }
      }
    },
  });

  // 初始化时检查 session 状态，如果正在处理中，自动开始轮询
  useEffect(() => {
    let mounted = true;

    const checkInitialStatus = async () => {
      // 停止之前的轮询
      shouldPollRef.current = false;
      isPollingRef.current = false;
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }

      // 等待一小段时间，确保 ref 已经设置好
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        if (mounted) {
          await checkStatusAndStartPolling();
        }
      } catch (error) {
        console.error('[useChatMessageSync] 初始化状态检查失败:', error);
      }
    };

    // 只在组件挂载时检查一次
    checkInitialStatus();

    return () => {
      mounted = false;
      stopPolling();
    };
  }, [sessionId, checkStatusAndStartPolling, stopPolling]);

  // 返回对外暴露的方法
  return {
    /** 手动触发状态检查和启动轮询 */
    checkStatusAndStartPolling,
    /** 手动获取消息（用于特殊场景，如取消后刷新状态） */
    fetchMessages,
  };
}
