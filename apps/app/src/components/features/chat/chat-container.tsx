/**
 * ChatContainer 组件
 * 自包含的聊天应用，内置 session 管理和 tabs 切换
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createSessionManager, type ChatMessage, type ChatSession as SessionData, type SessionManager } from '@/lib/browser/session-manager';
import { History, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useChatbotModelSelector } from './chat-input';
import { ChatSession } from './chat-session';

export interface ChatAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface ChatContainerProps {
  /** Session 管理器类型（当 sessionManager 未提供时使用） */
  sessionManagerType?: 'remote' | 'local';
  /** 自定义 Session 管理器实例（可选，优先于 sessionManagerType） */
  sessionManager?: SessionManager;
  /** 初始 sessionId（可选） */
  initialSessionId?: string;
  /** 外部控制的 sessionId（可选，用于路由控制） */
  sessionId?: string;
  /** 工具执行上下文（包含 canvasRef 等） */
  toolExecutionContext?: any;
  /** 外部操作按钮 */
  actions?: ChatAction[];
  /** API 端点前缀（可选，默认 '/api/chat'，FlowCanvas 使用 '/api/flowcanvas/agent'） */
  apiPrefix?: string;
}

/**
 * ChatContainer 组件
 * 内置 session 管理，通过 tabs 切换
 */
export const ChatContainer = ({
  sessionManagerType = 'local',
  sessionManager: externalSessionManager,
  initialSessionId,
  sessionId: externalSessionId,
  toolExecutionContext,
  actions = [],
  apiPrefix = '/api/chat',
}: ChatContainerProps) => {
  const [sessionManager] = useState(() => externalSessionManager || createSessionManager(sessionManagerType));
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId || externalSessionId || null);
  const [sessionMessages, setSessionMessages] = useState<Record<string, ChatMessage[]>>({});
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const { selectedModel } = useChatbotModelSelector();

  // 同步外部控制的 sessionId
  useEffect(() => {
    if (externalSessionId !== undefined) {
      setActiveSessionId(externalSessionId);
    }
  }, [externalSessionId]);

  // 加载 session 列表
  useEffect(() => {
    loadSessions();
  }, []);

  // 加载 sessions
  const loadSessions = async () => {
    setLoading(true);
    try {
      const result = await sessionManager.listSessions({ page: 1, pageSize: 10 });
      setSessions(result.sessions);

      // 如果有初始 sessionId，加载其消息
      if (initialSessionId || externalSessionId) {
        const sessionId = initialSessionId || externalSessionId;
        const messages = await sessionManager.getMessages(sessionId!);
        setSessionMessages(prev => ({ ...prev, [sessionId!]: messages }));
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  // 创建新 session
  const handleCreateSession = async () => {
    if (!selectedModel) {
      toast.error('Please select a model first');
      return;
    }

    try {
      const newSession = await sessionManager.createSession({
        modelId: selectedModel.id,
        title: 'New Chat',
      });

      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setSessionMessages(prev => ({ ...prev, [newSession.id]: [] }));

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
      await sessionManager.deleteSession(sessionId);

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
      try {
        const messages = await sessionManager.getMessages(sessionId);
        setSessionMessages(prev => ({ ...prev, [sessionId]: messages }));
      } catch (error) {
        console.error('Error loading messages:', error);
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Session Tabs */}
      <div className="flex items-center gap-2 px-1 py-1">
        <div className="flex flex-1 gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {sessions.map(session => (
            <Badge
              key={session.id}
              className="group cursor-pointer rounded-full transition-all duration-200"
              variant={activeSessionId === session.id ? 'default' : 'secondary'}
              onClick={() => handleSwitchSession(session.id)}
            >
              <span className="max-w-[120px] truncate">{session.title || 'New Chat'}</span>
              <span onClick={e => handleDeleteSession(session.id, e)} className="cursor-pointer">
                <X className="size-3 w-0 opacity-0 transition-all duration-200 ease-in-out group-hover:w-3 group-hover:opacity-100" />
              </span>
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-0.5">
          {/* 添加新 session */}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-7 hover:bg-transparent"
            onClick={handleCreateSession}
            disabled={!selectedModel}
          >
            <Plus className="size-4" />
          </Button>

          {/* 历史记录按钮 - 使用 Popover */}
          <Popover open={showHistory} onOpenChange={setShowHistory}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground size-7 hover:bg-transparent"
                disabled={!selectedModel}
              >
                <History className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="border-border/50 bg-background/95 w-[340px] p-0 shadow-lg backdrop-blur-sm" align="end">
              <ScrollArea className="h-[380px]">
                {sessions.length === 0 ? (
                  <div className="text-muted-foreground px-3 py-6 text-center text-xs">No chat history yet</div>
                ) : (
                  <div className="space-y-0.5 p-1.5">
                    {sessions.map(session => (
                      <div
                        key={session.id}
                        className={`group flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs transition-all ${
                          activeSessionId === session.id
                            ? 'bg-primary/5 text-foreground'
                            : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                        }`}
                        onClick={() => {
                          handleSwitchSession(session.id);
                          setShowHistory(false);
                        }}
                      >
                        <div className="flex-1 truncate font-medium">{session.title || 'Untitled Chat'}</div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-muted-foreground/60 text-[10px]">
                            {new Date(session.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive size-5 opacity-0 transition-all group-hover:opacity-100 hover:bg-transparent"
                            onClick={e => handleDeleteSession(session.id, e)}
                          >
                            <X className="size-2.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* 外部操作按钮 */}
          {actions.map((action: ChatAction) => (
            <Button
              key={action.id}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-7 hover:bg-transparent"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.icon}
            </Button>
          ))}
        </div>
      </div>

      {/* Chat Content */}
      <div className="flex-1 overflow-hidden">
        {activeSessionId ? (
          <ChatSession
            key={activeSessionId}
            sessionId={activeSessionId}
            initialMessages={sessionMessages[activeSessionId] || []}
            onClearChat={handleClearChat}
            disabled={!selectedModel}
            toolExecutionContext={toolExecutionContext}
            apiPrefix={apiPrefix}
            onTitleUpdated={handleTitleUpdated}
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center">{`Click "New" to start a chat`}</div>
        )}
      </div>
    </div>
  );
};
