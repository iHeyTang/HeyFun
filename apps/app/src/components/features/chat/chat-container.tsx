/**
 * ChatContainer 组件
 * 自包含的聊天应用，内置 session 管理
 * 支持两种布局：tabs（上方 tabs）和 sidebar（左侧侧边栏）
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useChatbotModelSelector } from './chat-input';
import { ChatSession } from './chat-session';
import { SessionTabs } from './session-tabs';
import { SessionSidebar } from './session-sidebar';
import { ChatContainerSkeleton } from './chat-container-skeleton';
import { ChatSessionSkeleton } from './chat-session-skeleton';
import { ChatMessages, ChatSessions } from '@prisma/client';
import { createChatSession, deleteSession, getChatSession, getChatSessions } from '@/actions/chat';

export interface ChatAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

type ChatContainerLayout = 'tabs' | 'sidebar';

interface ChatContainerProps {
  /** 初始 sessionId（可选） */
  initialSessionId?: string;
  /** 外部控制的 sessionId（可选，用于路由控制） */
  sessionId?: string;
  /** 外部操作按钮 */
  actions?: ChatAction[];
  /** API 端点前缀（可选，默认 '/api/agent'，FlowCanvas 使用 '/api/flowcanvas/agent'） */
  apiPrefix?: string;
  /** 布局类型：'tabs' 为上方 tabs，'sidebar' 为左侧侧边栏（默认 'tabs'） */
  layout?: ChatContainerLayout;
  /** 侧边栏宽度（仅当 layout='sidebar' 时生效，默认 '280px'） */
  sidebarWidth?: string;
}

/**
 * ChatContainer 组件
 * 内置 session 管理，支持 tabs 和 sidebar 两种布局
 */
export const ChatContainer = ({
  initialSessionId,
  sessionId: externalSessionId,
  actions = [],
  apiPrefix = '/api/agent',
  layout = 'tabs',
  sidebarWidth = '280px',
}: ChatContainerProps) => {
  const [sessions, setSessions] = useState<ChatSessions[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId || externalSessionId || null);
  const [sessionMessages, setSessionMessages] = useState<Record<string, ChatMessages[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState<Set<string>>(new Set());

  const { selectedModel } = useChatbotModelSelector();

  // 同步外部控制的 sessionId
  useEffect(() => {
    if (externalSessionId !== undefined) {
      setActiveSessionId(externalSessionId);
    }
  }, [externalSessionId]);

  // 加载 session 列表
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getChatSessions({ page: 1, pageSize: 10 });
      setSessions(result.data?.sessions || []);

      // 如果有初始 sessionId，加载其消息
      if (initialSessionId || externalSessionId) {
        const sessionId = initialSessionId || externalSessionId;
        setLoadingMessages(prev => new Set(prev).add(sessionId!));
        try {
          const session = await getChatSession({ sessionId: sessionId! });
          setSessionMessages(prev => ({ ...prev, [sessionId!]: session.data?.messages || [] }));
        } catch (error) {
          console.error('Error loading messages:', error);
        } finally {
          setLoadingMessages(prev => {
            const next = new Set(prev);
            next.delete(sessionId!);
            return next;
          });
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [initialSessionId, externalSessionId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 创建新 session
  const handleCreateSession = async () => {
    try {
      const createSessionResult = await createChatSession({
        title: 'New Chat',
      });
      if (!createSessionResult.data) {
        throw new Error('Failed to create session');
      }

      setSessions(prev => [createSessionResult.data, ...prev]);
      setActiveSessionId(createSessionResult.data.id);
      setSessionMessages(prev => ({ ...prev, [createSessionResult.data.id]: [] }));

      toast.success('New chat created');
    } catch (error) {
      toast.error('Failed to create chat');
      console.error('Create session error:', error);
    }
  };

  // 删除 session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await deleteSession({ sessionId });

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setSessionMessages(prev => {
        const newMessages = { ...prev };
        delete newMessages[sessionId];
        return newMessages;
      });

      // 如果删除的是当前 session，切换到第一个
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId);
        setActiveSessionId(remaining[0]?.id || null);
      }

      toast.success('Chat deleted');
    } catch (error) {
      toast.error('Failed to delete chat');
      console.error('Delete session error:', error);
    }
  };

  // 切换 session
  const handleSwitchSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);

    // 如果该 session 的消息还没加载，加载之
    if (!sessionMessages[sessionId]) {
      setLoadingMessages(prev => new Set(prev).add(sessionId));
      try {
        const messages = await getChatSession({ sessionId });
        setSessionMessages(prev => ({ ...prev, [sessionId]: messages.data?.messages || [] }));
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setLoadingMessages(prev => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }
    }
  };

  // 清空当前对话
  const handleClearChat = () => {
    if (activeSessionId) {
      setSessionMessages(prev => ({ ...prev, [activeSessionId]: [] }));
    }
  };

  // 标题更新回调
  const handleTitleUpdated = useCallback(
    (title: string) => {
      if (activeSessionId) {
        setSessions(prev => prev.map(s => (s.id === activeSessionId ? { ...s, title } : s)));
      }
    },
    [activeSessionId],
  );

  // 加载状态显示 Skeleton
  if (loading) {
    return <ChatContainerSkeleton layout={layout} sidebarWidth={sidebarWidth} />;
  }

  // Tabs 布局
  if (layout === 'tabs') {
    return (
      <div className="flex h-full flex-col">
        {/* Session Tabs */}
        <SessionTabs
          sessions={sessions}
          activeSessionId={activeSessionId}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
          onSwitchSession={handleSwitchSession}
          disabled={!selectedModel}
          actions={actions}
        />

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden">
          {activeSessionId ? (
            loadingMessages.has(activeSessionId) ? (
              <ChatSessionSkeleton />
            ) : (
              <ChatSession
                key={activeSessionId}
                sessionId={activeSessionId}
                initialMessages={sessionMessages[activeSessionId] || []}
                onClearChat={handleClearChat}
                disabled={!selectedModel}
                apiPrefix={apiPrefix}
                onTitleUpdated={handleTitleUpdated}
              />
            )
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center">{`Click "New" to start a chat`}</div>
          )}
        </div>
      </div>
    );
  }

  // Sidebar 布局
  return (
    <div className="flex h-full">
      {/* Session Sidebar */}
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        onSwitchSession={handleSwitchSession}
        actions={actions}
        width={sidebarWidth}
      />

      {/* Chat Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeSessionId ? (
          loadingMessages.has(activeSessionId) ? (
            <ChatSessionSkeleton />
          ) : (
            <ChatSession
              key={activeSessionId}
              sessionId={activeSessionId}
              initialMessages={sessionMessages[activeSessionId] || []}
              onClearChat={handleClearChat}
              disabled={!selectedModel}
              apiPrefix={apiPrefix}
              onTitleUpdated={handleTitleUpdated}
            />
          )
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center">{`Click "New" to start a chat`}</div>
        )}
      </div>
    </div>
  );
};
