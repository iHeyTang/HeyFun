'use client';

import { Markdown } from '@/components/block/markdown/markdown';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useLLM } from '@/hooks/use-llm';
import { cn } from '@/lib/utils';
import { Bot, Brain, ChevronDown, ChevronUp, User } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { ModelIcon } from '../model-icon';
import { ToolCallCard } from './tool-call-card';
import type { ToolCall, ToolResult } from './types';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  modelId?: string;
}

const ChatMessageComponent = ({ role, content, isStreaming = false, timestamp, toolCalls, toolResults, modelId }: ChatMessageProps) => {
  const isUser = role === 'user';
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const { availableModels } = useLLM();

  // 根据 modelId 获取模型信息
  const modelInfo = useMemo(() => {
    if (!modelId) return null;
    return availableModels.find(m => m.id === modelId) || null;
  }, [modelId, availableModels]);

  // 使用 useMemo 优化计算，避免每次渲染都重新计算
  const { thinkingContent, mainContent } = useMemo(() => {
    // 提取 thinking 内容
    const thinkingMatch = content.match(/<thinking[\s\S]*?>([\s\S]*?)<\/thinking>/);
    const thinking = thinkingMatch?.[1]?.trim() || null;

    // 移除 thinking 和 antml 标签，保留其他内容
    const main = content
      .replace(/<thinking[\s\S]*?<\/thinking>/g, '')
      .replace(/<antml[\s\S]*?<\/antml>/g, '')
      .trim();

    return { thinkingContent: thinking, mainContent: main };
  }, [content]);

  // 判断是否有特殊内容需要渲染
  const hasToolCalls = useMemo(() => toolCalls && toolCalls.length > 0, [toolCalls]);
  const hasToolResults = useMemo(() => toolResults && toolResults.length > 0, [toolResults]);

  return (
    <div className={cn('flex min-w-0 gap-3 px-4 py-1', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-white p-0">
            {modelInfo ? (
              <ModelIcon modelId={modelInfo.id} family={modelInfo.family} className="h-8 w-8 border p-1" size={32} />
            ) : (
              <Bot className="text-primary h-4 w-4" />
            )}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('group flex min-w-0 flex-1 flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
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
        {hasToolCalls && toolCalls && (
          <div className="min-w-0 max-w-[50%]">
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
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-secondary">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

// 使用 React.memo 优化，只有当 props 真正变化时才重新渲染
export const ChatMessage = memo(ChatMessageComponent, (prevProps, nextProps) => {
  // 自定义比较函数，只有关键属性变化时才重新渲染
  return (
    prevProps.role === nextProps.role &&
    prevProps.content === nextProps.content &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.timestamp.getTime() === nextProps.timestamp.getTime() &&
    prevProps.modelId === nextProps.modelId &&
    JSON.stringify(prevProps.toolCalls) === JSON.stringify(nextProps.toolCalls) &&
    JSON.stringify(prevProps.toolResults) === JSON.stringify(nextProps.toolResults)
  );
});
