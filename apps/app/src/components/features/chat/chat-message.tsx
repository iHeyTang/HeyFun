'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useLLM } from '@/hooks/use-llm';
import { cn } from '@/lib/utils';
import { Bot, Brain, ChevronDown, ChevronUp, User } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { ModelIcon } from '../model-icon';
import { ToolCallCard } from './tool-call-card';
import type { ToolCall, ToolResult } from './types';
import { Markdown } from '@/components/block/markdown';

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

  // 解析多模态内容（支持文本、图片和附件）
  const { thinkingContent, mainContent, attachments } = useMemo(() => {
    // 提取 thinking 内容
    const thinkingMatch = content.match(/<thinking[\s\S]*?>([\s\S]*?)<\/thinking>/);
    const thinking = thinkingMatch?.[1]?.trim() || null;

    // 尝试解析多模态内容（JSON格式）
    let parsedContent: string = content;
    const parsedAttachments: Array<{ type: string; url: string; name?: string; mimeType?: string }> = [];

    if (isUser && content.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          const textParts: string[] = [];

          for (const item of parsed) {
            if (item.type === 'text' && item.text) {
              textParts.push(item.text);
            } else if (item.type === 'image_url' && item.image_url?.url) {
              // 图片附件
              const url = item.image_url.url.startsWith('oss://') ? `/api/oss/${item.image_url.url.replace('oss://', '')}` : item.image_url.url;
              parsedAttachments.push({ type: 'image', url });
            } else if (item.type === 'attachment' && item.attachment) {
              // 其他附件
              const url = `/api/oss/${item.attachment.fileKey}`;
              parsedAttachments.push({
                type: item.attachment.type || 'file',
                url,
                name: item.attachment.name,
                mimeType: item.attachment.mimeType,
              });
            }
          }

          parsedContent = textParts.join('\n');
        }
      } catch (e) {
        // 解析失败，使用原始内容
      }
    }

    // 移除 thinking 和 antml 标签，保留其他内容
    const main = parsedContent
      .replace(/<thinking[\s\S]*?<\/thinking>/g, '')
      .replace(/<antml[\s\S]*?<\/antml>/g, '')
      .trim();

    return { thinkingContent: thinking, mainContent: main, attachments: parsedAttachments };
  }, [content, isUser]);

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
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          <div>{modelInfo?.name}</div>
          <span className="group-hover:text-muted-foreground text-transparent transition-all">{timestamp.toLocaleTimeString()}</span>
        </div>

        {/* 附件预览（仅用户消息） */}
        {isUser && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => {
              if (attachment.type === 'image') {
                // 图片附件
                return (
                  <img
                    key={index}
                    src={attachment.url}
                    alt={attachment.name || `Image ${index + 1}`}
                    className="max-h-48 max-w-xs rounded-lg object-cover"
                  />
                );
              } else if (attachment.type === 'video') {
                // 视频附件
                return (
                  <video key={index} src={attachment.url} controls className="max-h-48 max-w-xs rounded-lg" preload="metadata">
                    Your browser does not support the video tag.
                  </video>
                );
              } else if (attachment.type === 'audio') {
                // 音频附件
                return (
                  <div key={index} className="max-w-xs rounded-lg border p-2">
                    <audio src={attachment.url} controls className="w-full">
                      Your browser does not support the audio tag.
                    </audio>
                    {attachment.name && <div className="text-muted-foreground mt-1 text-xs">{attachment.name}</div>}
                  </div>
                );
              } else {
                // 文档或其他文件
                return (
                  <a
                    key={index}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-muted flex items-center gap-2 rounded-lg border p-2"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium">{attachment.name || `附件 ${index + 1}`}</div>
                      {attachment.mimeType && <div className="text-muted-foreground text-xs">{attachment.mimeType}</div>}
                    </div>
                  </a>
                );
              }
            })}
          </div>
        )}

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
