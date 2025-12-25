/**
 * SessionTabs 组件
 * 管理多个 sessions 的展示和切换
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatSessionsStore, useChatSessionsListStore } from '@/hooks/use-chat-sessions';
import { cn } from '@/lib/utils';
import { History, Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ChatAction } from './chat-container';
import { useChatbotModelSelector } from './chat-input';

interface SessionTabsProps {
  /** 是否禁用操作（通常基于是否选择了模型） */
  disabled?: boolean;
  /** 外部操作按钮 */
  actions?: ChatAction[];
}

/**
 * SessionTabs 组件
 * 展示 session tabs、创建按钮、历史记录和外部操作按钮
 */
export const SessionTabs = ({ disabled: externalDisabled = false, actions = [] }: SessionTabsProps) => {
  const [showHistory, setShowHistory] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // 直接从 store 获取数据和方法
  const { sessions, activeSessionId, sessionInputValues, createSession, deleteSession, switchSession, hasRealContent } = useChatSessionsStore();

  const { selectedModel } = useChatbotModelSelector();
  const disabled = externalDisabled || !selectedModel;

  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      await createSession({ title: 'New Chat' });
      toast.success('New chat created');
    } catch (error) {
      toast.error('Failed to create chat');
      console.error('Create session error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteSession(sessionId);
      toast.success('Chat deleted');
    } catch (error) {
      toast.error('Failed to delete chat');
      console.error('Delete session error:', error);
    }
  };

  const handleSwitchSession = async (sessionId: string) => {
    await switchSession(sessionId);
  };

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      {/* Session Tabs */}
      <div className="flex flex-1 gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {sessions.map(session => {
          const hasInput = hasRealContent(sessionInputValues[session.id]);
          const isProcessing = session.status === 'processing' || session.status === 'pending';
          return (
            <Badge
              key={session.id}
              className="group cursor-pointer rounded-full transition-all duration-200"
              variant={activeSessionId === session.id ? 'default' : 'secondary'}
              onClick={() => handleSwitchSession(session.id)}
            >
              {hasInput ? (
                <span className="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" title="有未发送的内容" />
              ) : (
                isProcessing && <span className="mr-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-green-500" title="正在处理中" />
              )}
              <span className="max-w-[120px] truncate">{session.title || 'New Chat'}</span>
              <span onClick={e => handleDeleteSession(session.id, e)} className="cursor-pointer">
                <X className="size-3 w-0 opacity-0 transition-all duration-200 ease-in-out group-hover:w-3 group-hover:opacity-100" />
              </span>
            </Badge>
          );
        })}
      </div>

      <div className="flex items-center gap-0.5">
        {/* 添加新 session */}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-7 hover:bg-transparent"
          onClick={handleCreateSession}
          disabled={disabled || isCreating}
        >
          {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>

        {/* 历史记录按钮 - 使用 Popover */}
        <Popover open={showHistory} onOpenChange={setShowHistory}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-7 hover:bg-transparent"
              disabled={disabled}
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
                  {sessions.map(session => {
                    const hasInput = hasRealContent(sessionInputValues[session.id]);
                    return (
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
                        <div className="flex items-center gap-1.5">
                          {hasInput ? (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" title="有未发送的内容" />
                          ) : (
                            <div
                              className={cn(
                                'h-1.5 w-1.5 shrink-0 rounded-full',
                                session.status === 'processing' || session.status === 'pending' ? 'animate-pulse bg-green-500' : '',
                              )}
                              title={session.status === 'processing' || session.status === 'pending' ? '正在处理中' : undefined}
                            />
                          )}
                          <div className="flex-1 truncate font-medium">{session.title || 'Untitled Chat'}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-muted-foreground/60 text-[10px]">
                            {new Date(session.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive size-5 opacity-0 transition-all hover:bg-transparent group-hover:opacity-100"
                            onClick={e => handleDeleteSession(session.id, e)}
                          >
                            <X className="size-2.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
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
  );
};
