'use client';

import { AgentHome } from '@/app/dashboard/agent/agent-home';
import { useParams } from 'next/navigation';
import { useChatSessionsStore, useChatSessionsListStore } from '@/hooks/use-chat-sessions';
import { useChatbotModelSelector } from '@/components/features/chat/chat-input';
import { ChatSession } from '@/components/features/chat/chat-session';
import { ChatSessionSkeleton } from '@/components/features/chat/chat-session-skeleton';
import { useEffect, useRef } from 'react';

export default function AgentSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId;

  const { selectedModel } = useChatbotModelSelector();
  const {
    activeSessionId,
    sessionMessages,
    loading,
    loadingMessages,
    loadSessions,
    setActiveSessionId: setActiveSessionIdAction,
    fetchAndUpdateMessages,
  } = useChatSessionsStore();
  const { setLoadingMessage } = useChatSessionsListStore();

  // 初始化加载 sessions
  const prevSessionIdRef = useRef<string | undefined>(sessionId);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    const hasChanged = prevSessionIdRef.current !== sessionId;
    if (isInitialMountRef.current || hasChanged) {
      loadSessions({
        initialSessionId: sessionId,
        externalSessionId: sessionId,
      });
      prevSessionIdRef.current = sessionId;
      isInitialMountRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // 当 sessionId 变化时，同步更新 activeSessionId
  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId) {
      setActiveSessionIdAction(sessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // 当 activeSessionId 变化时，如果该 session 没有消息，主动获取一次
  const fetchedSessionsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (activeSessionId) {
      const hasMessages = (sessionMessages[activeSessionId]?.length ?? 0) > 0;
      const isLoading = loadingMessages.has(activeSessionId);
      const hasFetched = fetchedSessionsRef.current.has(activeSessionId);

      if (!hasMessages && !isLoading && !hasFetched) {
        fetchedSessionsRef.current.add(activeSessionId);
        setLoadingMessage(activeSessionId, true);
        fetchAndUpdateMessages({ sessionId: activeSessionId, apiPrefix: '/api/agent' }).finally(() => {
          setLoadingMessage(activeSessionId, false);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  // 加载状态显示 Skeleton
  if (loading) {
    return <ChatSessionSkeleton />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {activeSessionId ? (
        loadingMessages.has(activeSessionId) ? (
          <ChatSessionSkeleton />
        ) : (sessionMessages[activeSessionId]?.length ?? 0) > 0 ? (
          <ChatSession
            key={activeSessionId}
            sessionId={activeSessionId}
            initialMessages={sessionMessages[activeSessionId] || []}
            disabled={!selectedModel}
          />
        ) : (
          <AgentHome />
        )
      ) : (
        <AgentHome />
      )}
    </div>
  );
}
