'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Markdown } from '@/components/block/markdown/markdown';
import { ToolCallCard } from './tool-call-card';
import type { ToolCall, ToolResult } from './types';
import { useState } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export const ChatMessage = ({ role, content, isStreaming = false, timestamp, toolCalls, toolResults }: ChatMessageProps) => {
  const isUser = role === 'user';
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  // 提取 thinking 内容
  const thinkingMatch = content.match(/<thinking[\s\S]*?>([\s\S]*?)<\/thinking>/);
  const thinkingContent = thinkingMatch?.[1]?.trim() || null;

  // 移除 thinking 和 antml 标签，保留其他内容
  const mainContent = content
    .replace(/<thinking[\s\S]*?<\/thinking>/g, '')
    .replace(/<antml[\s\S]*?<\/antml>/g, '')
    .trim();

  // 判断是否有特殊内容需要渲染
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasToolResults = toolResults && toolResults.length > 0;

  return (
    <div className={cn('flex gap-3 px-4 py-1', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('group flex w-full flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
        <span className="group-hover:text-muted-foreground text-xs text-transparent transition-all">{timestamp.toLocaleTimeString()}</span>

        {/* 消息内容（包含思考过程和主要内容） */}
        {(mainContent || thinkingContent) && (
          <div className={cn('bg-muted max-w-[70%] rounded-lg')}>
            {/* Thinking 过程 - 可折叠 */}
            {thinkingContent && (
              <div className="border-border/50 border-b">
                <button
                  onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                  className="hover:bg-muted/50 flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
                >
                  <Brain className="h-4 w-4 opacity-60" />
                  <span className="text-muted-foreground opacity-80">Thinking</span>
                  <span className="text-muted-foreground ml-auto text-xs opacity-60">
                    {isThinkingExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </button>
                {isThinkingExpanded && (
                  <div className="bg-muted/30 border-border/30 border-t px-4 py-3">
                    <Markdown className="text-muted-foreground markdown-body text-sm opacity-80">{thinkingContent}</Markdown>
                  </div>
                )}
              </div>
            )}

            {/* 主要内容 */}
            {mainContent && <Markdown className="markdown-body">{mainContent}</Markdown>}
          </div>
        )}

        {/* 工具调用卡片（包含结果）- 更小的宽度 */}
        {hasToolCalls && (
          <div className="max-w-[50%]">
            <ToolCallCard toolCalls={toolCalls} toolResults={toolResults} />
          </div>
        )}

        {/* 空状态 - 正在思考 */}
        {!mainContent && !hasToolCalls && !thinkingContent && (
          <div className="bg-muted max-w-[70%] rounded-lg">
            <Markdown className="w-full">Thinking...</Markdown>
          </div>
        )}
      </div>

      {isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-secondary">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};
