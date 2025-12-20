/**
 * ChatContainer 组件
 * 自包含的聊天应用，内置 session 管理
 * 支持两种布局：tabs（上方 tabs）和 sidebar（左侧侧边栏）
 */

'use client';

import { useChatSessionsStore } from '@/hooks/use-chat-sessions';
import { ChatSessions } from '@prisma/client';
import { useEffect } from 'react';
import { ChatContainerSkeleton } from './chat-container-skeleton';
import { useChatbotModelSelector } from './chat-input';
import { ChatSession } from './chat-session';
import { ChatSessionSkeleton } from './chat-session-skeleton';
import { SessionSidebar } from './session-sidebar';
import { SessionTabs } from './session-tabs';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

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
  /** 受控的输入框值（用于从外部临时设置输入框内容，如从编辑器添加 mention） */
  inputValue?: string;
  /** 输入框值变化回调（用于从外部临时设置输入框内容） */
  onInputValueChange?: (value: string) => void;
  /** 自定义 session 加载函数（可选，如果提供则使用此函数而不是默认的 getChatSessions） */
  loadSessionsFn?: () => Promise<ChatSessions[]>;
  /** 自定义 session 创建函数（可选，如果提供则使用此函数而不是默认的 createChatSession） */
  createSessionFn?: () => Promise<ChatSessions>;
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
  inputValue: controlledInputValue,
  onInputValueChange,
  loadSessionsFn,
  createSessionFn,
}: ChatContainerProps) => {
  const { selectedModel } = useChatbotModelSelector();

  // 使用 Zustand store
  const {
    activeSessionId,
    sessionMessages,
    sessionInputValues,
    loading,
    loadingMessages,
    loadSessions,
    setSessionInputValue,
    setActiveSessionId: setActiveSessionIdAction,
  } = useChatSessionsStore();

  // 初始化加载 sessions
  useEffect(() => {
    loadSessions({
      loadSessionsFn,
      initialSessionId,
      externalSessionId,
    });
  }, [loadSessions, loadSessionsFn, initialSessionId, externalSessionId]);

  // 同步外部控制的 sessionId
  useEffect(() => {
    if (externalSessionId !== undefined && externalSessionId !== activeSessionId) {
      setActiveSessionIdAction(externalSessionId);
      // 切换 session 时，恢复该 session 的输入值（如果有）
      const sessionInputValue = sessionInputValues[externalSessionId] || '';
      if (onInputValueChange) {
        onInputValueChange(sessionInputValue);
      }
    }
  }, [externalSessionId, activeSessionId, sessionInputValues, onInputValueChange, setActiveSessionIdAction]);

  // 同步外部控制的输入值到当前活动的 session（用于从编辑器添加 mention）
  useEffect(() => {
    if (controlledInputValue !== undefined && activeSessionId) {
      const currentValue = sessionInputValues[activeSessionId] || '';
      // 只有当新值与当前值不同时才更新（避免循环更新）
      if (controlledInputValue !== currentValue) {
        setSessionInputValue(activeSessionId, controlledInputValue);
      }
    }
  }, [controlledInputValue, activeSessionId, sessionInputValues, setSessionInputValue]);

  // 当 activeSessionId 变化时，通知外部输入值变化
  useEffect(() => {
    if (activeSessionId && onInputValueChange) {
      const sessionInputValue = sessionInputValues[activeSessionId] || '';
      onInputValueChange(sessionInputValue);
    }
  }, [activeSessionId, sessionInputValues, onInputValueChange]);

  // 加载状态显示 Skeleton
  if (loading) {
    return <ChatContainerSkeleton layout={layout} sidebarWidth={sidebarWidth} />;
  }

  // Tabs 布局
  if (layout === 'tabs') {
    return (
      <div className="flex h-full flex-col">
        {/* Session Tabs */}
        <SessionTabs disabled={!selectedModel} actions={actions} />

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
                disabled={!selectedModel}
                apiPrefix={apiPrefix}
                inputValue={controlledInputValue}
                onInputValueChange={onInputValueChange}
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
    <ResizablePanelGroup direction="horizontal" className="flex h-full">
      {/* Session Sidebar */}
      <ResizablePanel defaultSize={10} minSize={10} maxSize={40} className="min-w-[240px]">
        <SessionSidebar disabled={!selectedModel} actions={actions} />
      </ResizablePanel>
      <ResizableHandle />
      {/* Chat Content */}
      <ResizablePanel defaultSize={90} minSize={60} maxSize={90} className="flex flex-1 flex-col overflow-hidden">
        {activeSessionId ? (
          loadingMessages.has(activeSessionId) ? (
            <ChatSessionSkeleton />
          ) : (
            <ChatSession
              key={activeSessionId}
              sessionId={activeSessionId}
              initialMessages={sessionMessages[activeSessionId] || []}
              disabled={!selectedModel}
              apiPrefix={apiPrefix}
              inputValue={controlledInputValue}
              onInputValueChange={onInputValueChange}
            />
          )
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center">{`Click "New" to start a chat`}</div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
