'use client';

import { createNote } from '@/actions/notes';
import LoadingDots from '@/components/block/loading/loading-dots';
import { WysiwygEditor } from '@/components/block/wysiwyg-editor';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLLM } from '@/hooks/use-llm';
import { cn } from '@/lib/utils';
import { BookOpen, Bot, Brain, Check, ChevronDown, ChevronUp, Copy, User } from 'lucide-react';
import Image from 'next/image';
import { memo, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ModelIcon } from '../model-icon';
import { ToolCallCard } from './tool-call-card';
import { ImagePreview } from '@/components/block/preview/image-preview';
import { MicroAgentExecution } from './micro-agent-execution';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

/**
 * 微代理执行链路列表组件
 * 过滤掉跳过的微代理，样式与 ToolCallCard 保持一致
 */
const MicroAgentExecutionsList = memo(function MicroAgentExecutionsList({
  executions,
}: {
  executions: any[];
}) {
  // 过滤掉跳过的微代理
  const filteredExecutions = executions.filter((execution) => execution.status !== 'skipped');

  // 如果没有有效的微代理，不显示
  if (filteredExecutions.length === 0) {
    return null;
  }

  // 如果只有一个微代理，显示精简版
  if (filteredExecutions.length === 1) {
    return (
      <div className="min-w-0 space-y-0">
        <MicroAgentExecution detail={filteredExecutions[0] as any} />
      </div>
    );
  }

  // 多个微代理时，显示紧凑列表
  return (
    <div className="min-w-0 space-y-1">
      {filteredExecutions.map((execution, index) => (
        <MicroAgentExecution key={`${execution.agentId}-${index}`} detail={execution as any} />
      ))}
    </div>
  );
});

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp: Date;
  toolCalls?: PrismaJson.ToolCall[];
  toolResults?: PrismaJson.ToolResult[];
  modelId?: string;
  messageId?: string;
  sessionId?: string;
  tokenCount?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedInputTokens?: number | null;
  cachedOutputTokens?: number | null;
  microAgentExecutions?: Array<{
    agentId: string;
    agentName: string;
    trigger: string;
    status: 'executing' | 'success' | 'skipped' | 'failed';
    startTime?: number;
    endTime?: number;
    duration?: number;
    result?: any;
    message?: string;
  }>;
}

// 带 Tooltip 的消息操作按钮组件
interface MessageActionButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
}

const MessageActionButton = ({ icon, tooltip, onClick, disabled = false }: MessageActionButtonProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className="group-hover:text-muted-foreground hover:text-foreground cursor-pointer text-transparent transition-all disabled:cursor-not-allowed disabled:opacity-50"
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const ChatMessageComponent = ({
  role,
  content,
  isStreaming = false,
  timestamp,
  toolCalls,
  toolResults,
  modelId,
  messageId,
  sessionId,
  tokenCount,
  inputTokens,
  outputTokens,
  cachedInputTokens,
  cachedOutputTokens,
  microAgentExecutions,
}: ChatMessageProps) => {
  const isUser = role === 'user';

  // 调试：检查微代理执行详情
  if (!isUser && microAgentExecutions) {
    console.log('[ChatMessageComponent] 微代理执行详情:', {
      messageId,
      hasExecutions: !!microAgentExecutions,
      count: Array.isArray(microAgentExecutions) ? microAgentExecutions.length : 0,
      executions: microAgentExecutions,
    });
  }

  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
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

  // 复制到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mainContent || content);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      toast.error('复制失败');
    }
  };

  // 保存到笔记
  const handleSaveToNote = async () => {
    if (!mainContent && !content) {
      toast.error('没有可保存的内容');
      return;
    }

    try {
      setIsSaving(true);
      const noteContent = mainContent || content;
      const title = noteContent.slice(0, 50).replace(/\n/g, ' ').trim() || '来自聊天的笔记';

      const result = await createNote({
        title,
        content: noteContent,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.data) {
        toast.success('已保存到笔记');
      }
    } catch (error: any) {
      console.error('保存到笔记失败:', error);
      toast.error(error.message || '保存到笔记失败');
    } finally {
      setIsSaving(false);
    }
  };

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
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <div>{modelInfo?.name}</div>
          <span className="group-hover:text-muted-foreground text-transparent transition-all">{timestamp.toLocaleTimeString()}</span>
          {!isUser && (mainContent || content) && (
            <>
              <MessageActionButton
                icon={copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                tooltip="复制"
                onClick={handleCopy}
              />
              <MessageActionButton icon={<BookOpen className="h-3 w-3" />} tooltip="保存到笔记" onClick={handleSaveToNote} disabled={isSaving} />
            </>
          )}
        </div>

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
                    <WysiwygEditor
                      value={thinkingContent}
                      readOnly={true}
                      showToolbar={false}
                      isStreaming={false}
                      className="text-sm opacity-80"
                      editorClassName="p-3 py-2"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 主要内容 */}
            {mainContent && (
              <WysiwygEditor
                value={mainContent}
                readOnly={true}
                showToolbar={false}
                isStreaming={false}
                className="text-sm opacity-80"
                editorClassName="p-3 py-2"
              />
            )}
          </div>
        )}

        {/* 附件预览（仅用户消息） */}
        {isUser && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => {
              if (attachment.type === 'image') {
                // 图片附件
                return (
                  <ImagePreview
                    key={index}
                    src={attachment.url}
                    alt={attachment.name || `Image ${index + 1}`}
                    className="h-12 w-12 rounded-lg object-cover"
                    width={100}
                    height={100}
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

        {/* 工具调用卡片（包含结果）- 更小的宽度 */}
        {/* 微代理执行详情 - 默认折叠，紧凑展示 */}
        {!isUser && microAgentExecutions && microAgentExecutions.length > 0 && (
          <div className="min-w-0 max-w-[50%]">
            <MicroAgentExecutionsList executions={microAgentExecutions} />
          </div>
        )}

        {hasToolCalls && toolCalls && (
          <div className="min-w-0 max-w-[50%]">
            <ToolCallCard toolCalls={toolCalls} toolResults={toolResults} messageId={messageId} sessionId={sessionId} />
          </div>
        )}

        {/* 空状态 - 正在思考（仅 assistant 消息且没有内容时显示） */}
        {!isUser && !mainContent && !hasToolCalls && !thinkingContent && (
          <div className="bg-muted max-w-[70%] rounded-lg px-4 py-3">
            <LoadingDots label="Thinking" />
          </div>
        )}

        {/* Token 数量显示 - 在消息/工具下方，只在 hover 时显示 */}
        {((inputTokens !== null && inputTokens !== undefined) ||
          (outputTokens !== null && outputTokens !== undefined) ||
          (cachedInputTokens !== null && cachedInputTokens !== undefined) ||
          (cachedOutputTokens !== null && cachedOutputTokens !== undefined) ||
          (tokenCount !== null && tokenCount !== undefined)) && (
          <div className="group-hover:text-muted-foreground/70 text-xs text-transparent transition-all">
            {(() => {
              const parts: string[] = [];
              if (inputTokens !== null && inputTokens !== undefined) {
                parts.push(`输入: ${inputTokens.toLocaleString()}`);
              }
              if (outputTokens !== null && outputTokens !== undefined) {
                parts.push(`输出: ${outputTokens.toLocaleString()}`);
              }
              if (cachedInputTokens !== null && cachedInputTokens !== undefined && cachedInputTokens > 0) {
                parts.push(`缓存输入: ${cachedInputTokens.toLocaleString()}`);
              }
              if (cachedOutputTokens !== null && cachedOutputTokens !== undefined && cachedOutputTokens > 0) {
                parts.push(`缓存输出: ${cachedOutputTokens.toLocaleString()}`);
              }
              if (parts.length > 0) {
                return parts.join(' · ');
              }
              if (tokenCount !== null && tokenCount !== undefined) {
                return `${tokenCount.toLocaleString()} tokens`;
              }
              return '';
            })()}
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
    prevProps.tokenCount === nextProps.tokenCount &&
    prevProps.inputTokens === nextProps.inputTokens &&
    prevProps.outputTokens === nextProps.outputTokens &&
    prevProps.cachedInputTokens === nextProps.cachedInputTokens &&
    prevProps.cachedOutputTokens === nextProps.cachedOutputTokens &&
    JSON.stringify(prevProps.toolCalls) === JSON.stringify(nextProps.toolCalls) &&
    JSON.stringify(prevProps.toolResults) === JSON.stringify(nextProps.toolResults)
  );
});
