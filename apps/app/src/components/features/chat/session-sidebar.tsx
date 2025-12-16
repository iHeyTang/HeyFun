/**
 * SessionSidebar 组件
 * 左侧侧边栏形式的 session 管理
 */

'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatSessions } from '@prisma/client';
import { Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { ChatAction } from './chat-container';
import { cn } from '@/lib/utils';

interface SessionSidebarProps {
  /** Sessions 列表 */
  sessions: ChatSessions[];
  /** 当前激活的 sessionId */
  activeSessionId: string | null;
  /** 创建新 session 的回调 */
  onCreateSession: () => void;
  /** 删除 session 的回调 */
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void;
  /** 切换 session 的回调 */
  onSwitchSession: (sessionId: string) => void;
  /** 是否禁用操作（通常基于是否选择了模型） */
  disabled?: boolean;
  /** 外部操作按钮 */
  actions?: ChatAction[];
  /** 侧边栏宽度（可选，默认 280px） */
  width?: string;
}

/**
 * SessionSidebar 组件
 * 左侧侧边栏展示 sessions 列表
 */
export const SessionSidebar = ({
  sessions,
  activeSessionId,
  onCreateSession,
  onDeleteSession,
  onSwitchSession,
  disabled = false,
  actions = [],
  width = '280px',
}: SessionSidebarProps) => {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      const result = onCreateSession();
      await Promise.resolve(result);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="border-border/50 bg-background/50 flex h-full flex-col border-r" style={{ width }}>
      {/* Header */}
      <div className="border-border/50 flex items-center justify-between border-b px-3 py-2">
        <div className="text-sm font-medium">Chats</div>
        <div className="flex items-center gap-0.5">
          {/* 添加新 session */}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-7 hover:bg-transparent"
            onClick={handleCreateSession}
            disabled={disabled || isCreating}
            title="New Chat"
          >
            {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>

          {/* 外部操作按钮 */}
          {actions.map((action: ChatAction) => (
            <Button
              key={action.id}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-7 hover:bg-transparent"
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.label}
            >
              {action.icon}
            </Button>
          ))}
        </div>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        {sessions.length === 0 ? (
          <div className="text-muted-foreground px-3 py-6 text-center text-xs">No chat history yet</div>
        ) : (
          <div className="space-y-0.5 p-1.5">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`group flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-all ${
                  activeSessionId === session.id ? 'bg-primary/5 text-foreground' : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                }`}
                onClick={() => onSwitchSession(session.id)}
              >
                <div className={cn('h-1.5 w-1.5 rounded-full', session.status === 'processing' ? 'animate-pulse bg-green-500' : '')} />
                <div className="flex-1 truncate font-medium">{session.title || 'Untitled Chat'}</div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-muted-foreground/60 text-xs">
                    {new Date(session.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-5 opacity-0 transition-all hover:bg-transparent group-hover:opacity-100"
                    onClick={e => onDeleteSession(session.id, e)}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
