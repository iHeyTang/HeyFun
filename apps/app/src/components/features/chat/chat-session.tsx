/**
 * ChatSession 组件
 * 内层组件：只负责维护一个 session 内的对话
 */

'use client';

import type { ChatInputAttachment } from '@/components/block/chat-input/index';
import { RealtimeProviderWrapper } from '@/components/providers/realtime-provider';
import { useAutoScrollToBottom } from '@/hooks/use-auto-scroll-to-bottom';
import { useChatSendMessage } from '@/hooks/use-chat-send-message';
import { useChatSessionsStore } from '@/hooks/use-chat-sessions';
import { useChatMessageSync } from '@/hooks/use-chat-message-sync';
import { ChatMessages } from '@prisma/client';
import { useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { ChatInput, useChatbotModelSelector } from './chat-input';
import { ChatMessage as ChatMessageComponent } from './chat-message';
import { ThinkingMessage } from './thinking-message';

interface ChatSessionProps {
  /** 必需的 sessionId */
  sessionId: string;
  /** 初始消息列表 */
  initialMessages?: ChatMessages[];
  /** 是否禁用输入 */
  disabled?: boolean;
}

/**
 * ChatSession 组件
 * 只负责在一个已存在的 session 中进行对话
 */
function ChatSessionComponent({ sessionId, initialMessages = [], disabled = false }: ChatSessionProps) {
  // 直接从 store 获取所有数据和方法
  const { sessionMessages, sessionLoadingStates } = useChatSessionsStore();

  // 从 store 获取当前 session 的消息和加载状态
  const messages = sessionMessages[sessionId] || initialMessages;
  const isLoading = sessionLoadingStates[sessionId] || false;

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { selectedModel } = useChatbotModelSelector();

  // 使用消息同步 hook（统一管理 realtime 和 polling）
  const { checkStatusAndStartPolling } = useChatMessageSync({ sessionId });

  // 判断是否需要显示思考中消息
  // 注意：只有当最后一条消息是 user 消息时才显示 ThinkingMessage
  // 如果最后一条消息是空的 assistant 消息，由 ChatMessage 组件自己显示 Thinking 占位符
  const shouldShowThinkingMessage = useMemo(() => {
    if (!isLoading || messages.length === 0) {
      return false;
    }
    const lastMessage = messages[messages.length - 1];
    // 最后一条消息是 user 消息，且正在加载中
    return lastMessage && lastMessage.role === 'user';
  }, [messages, isLoading]);

  // 使用自动滚动到底部的 hook
  // trigger 包括消息数量、最后一条消息的ID和内容（用于流式更新）、思考中消息的显示状态
  const scrollTrigger = useMemo(() => {
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    return [messages.length, lastMessage?.id, lastMessage?.content, lastMessage?.isStreaming, shouldShowThinkingMessage];
  }, [messages, shouldShowThinkingMessage]);

  useAutoScrollToBottom({
    containerRef: messagesContainerRef,
    trigger: scrollTrigger,
    enabled: true,
  });

  // 处理中断请求
  const handleCancel = useCallback(async () => {
    try {
      const response = await fetch(`/api/agent/chat/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to cancel: ${response.status}`);
      }
    } catch (error) {
      console.error('[ChatSession] 中断失败:', error);
      toast.error('中断失败: ' + (error as Error).message);
    }
  }, [sessionId]);

  // 使用发送消息 hook
  const { sendMessage } = useChatSendMessage({ sessionId, selectedModel, isLoading });

  // 包装 sendMessage，在发送成功后处理轮询
  const handleSendMessage = useCallback(
    async (content: string, attachments?: ChatInputAttachment[]) => {
      try {
        const result = await sendMessage(content, attachments);
        console.log('[ChatSession] 消息发送成功，开始处理轮询', result);

        // 立即请求一次 messages，获取最新状态并启动轮询（如果需要）
        await checkStatusAndStartPolling();
      } catch (error) {
        // 错误已在 sendMessage 中处理，这里不需要额外处理
        console.error('[ChatSession] 发送消息失败:', error);
      }
    },
    [sendMessage, checkStatusAndStartPolling],
  );

  const usage = useMemo(() => {
    if (messages.length === 0) {
      return undefined;
    }
    return {
      inputTokens: messages.reduce((sum, msg) => {
        return sum + (msg.inputTokens ?? 0);
      }, 0),
      outputTokens: messages.reduce((sum, msg) => {
        return sum + (msg.outputTokens ?? 0);
      }, 0),
      cachedInputTokens: messages.reduce((sum, msg) => {
        return sum + (msg.cachedInputTokens ?? 0);
      }, 0),
      cachedOutputTokens: messages.reduce((sum, msg) => {
        return sum + (msg.cachedOutputTokens ?? 0);
      }, 0),
    };
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="min-w-0 space-y-0">
          {messages.map((message, index) => (
            <ChatMessageComponent
              key={message.id}
              role={message.role as 'user' | 'assistant'}
              content={message.content}
              isStreaming={message.isStreaming}
              timestamp={message.createdAt}
              toolCalls={message.toolCalls || []}
              toolResults={message.toolResults || []}
              modelId={message.role === 'assistant' ? (message.modelId ?? undefined) : undefined}
              messageId={message.id}
              sessionId={sessionId}
              tokenCount={message.tokenCount ?? undefined}
              inputTokens={message.inputTokens ?? undefined}
              outputTokens={message.outputTokens ?? undefined}
              cachedInputTokens={message.cachedInputTokens ?? undefined}
              cachedOutputTokens={message.cachedOutputTokens ?? undefined}
              metadata={message.metadata}
              onSendMessage={handleSendMessage}
              isLastMessage={index === messages.length - 1}
            />
          ))}
          {shouldShowThinkingMessage && <ThinkingMessage modelId={selectedModel?.id} label="思考中" />}
        </div>
      </div>
      {/* Input */}
      <ChatInput
        sessionId={sessionId}
        usage={usage}
        onSend={handleSendMessage}
        disabled={isLoading || disabled}
        isLoading={isLoading}
        onCancel={handleCancel}
      />
    </div>
  );
}

export const ChatSession = (props: ChatSessionProps) => {
  return (
    <RealtimeProviderWrapper>
      <ChatSessionComponent {...props} />
    </RealtimeProviderWrapper>
  );
};
