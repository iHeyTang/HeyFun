/**
 * ChatSession 组件
 * 内层组件：只负责维护一个 session 内的对话
 */

'use client';

import type { ChatInputAttachment } from '@/components/block/chat-input/index';
import { ThemeLogo } from '@/components/features/theme-logo';
import { useChatSendMessage } from '@/hooks/use-chat-send-message';
import { useChatMessagesStore, useChatSessionsStore } from '@/hooks/use-chat-sessions';
import { ChatMessages } from '@prisma/client';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { ChatInput, useChatbotModelSelector } from './chat-input';
import { ChatMessage as ChatMessageComponent } from './chat-message';
import { ThinkingMessage } from './thinking-message';
import { A2UIProvider } from '@/components/features/a2ui';

interface ChatSessionProps {
  /** 必需的 sessionId */
  sessionId: string;
  /** 初始消息列表 */
  initialMessages?: ChatMessages[];
  /** 是否禁用输入 */
  disabled?: boolean;
  /** 受控的输入框值（用于从外部临时设置输入框内容，如从编辑器添加 mention） */
  inputValue?: string;
  /** 输入框值变化回调（用于从外部临时设置输入框内容） */
  onInputValueChange?: (value: string) => void;
}

/**
 * ChatSession 组件
 * 只负责在一个已存在的 session 中进行对话
 */
export function ChatSession({
  sessionId,
  initialMessages = [],
  disabled = false,
  inputValue: controlledInputValue,
  onInputValueChange,
}: ChatSessionProps) {
  const apiPrefix = '/api/agent';
  // 直接从 store 获取所有数据和方法
  const {
    sessionInputValues,
    sessionAttachments,
    sessionMessages,
    sessionLoadingStates,
    setSessionInputValue,
    setSessionAttachments,
    setSessionLoading,
  } = useChatSessionsStore();

  // 从 store 获取当前 session 的消息和加载状态
  const messages = sessionMessages[sessionId] || initialMessages;
  const isLoading = sessionLoadingStates[sessionId] || false;

  // 获取当前 session 的输入值和附件
  const storeInputValue = sessionInputValues[sessionId] || '';
  const storeAttachments = sessionAttachments[sessionId] || [];
  // 输入框值管理（支持受控和非受控）
  const inputValue = controlledInputValue !== undefined ? controlledInputValue : storeInputValue;
  const handleInputValueChange = (value: string) => {
    setSessionInputValue(sessionId, value);
    // 如果是受控的，也通知外部
    if (controlledInputValue !== undefined && onInputValueChange) {
      onInputValueChange(value);
    }
  };

  // 附件管理
  const attachments = storeAttachments;
  const handleAttachmentsChange = (newAttachments: ChatInputAttachment[]) => {
    setSessionAttachments(sessionId, newAttachments);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const shouldPollRef = useRef<boolean>(false);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false); // 防止多个轮询实例同时运行
  const { selectedModel } = useChatbotModelSelector();

  // 使用 useCallback 优化滚动函数
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 只在消息数量变化时滚动，而不是每次消息内容更新都滚动
  const messageCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length !== messageCountRef.current) {
      messageCountRef.current = messages.length;
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // 使用消息 store
  const { fetchAndUpdateMessages } = useChatMessagesStore();

  // 获取消息并更新状态（使用 ref 存储回调，避免依赖项变化导致重新创建）
  const fetchMessagesRef = useRef<(() => Promise<{ status: string; shouldContinue: boolean }>) | undefined>(undefined);

  const fetchMessages = useCallback(async (): Promise<{ status: string; shouldContinue: boolean }> => {
    // 使用 store 封装的 fetchAndUpdateMessages，自动处理状态和标题更新
    // 这个方法已经会自动更新 store 中的 sessionMessages
    const result = await fetchAndUpdateMessages({ sessionId, apiPrefix });

    // 更新最后一条消息ID
    if (result.messages.length > 0) {
      lastMessageIdRef.current = result.messages[result.messages.length - 1]!.id;
    }

    console.log('[ChatSession] 获取消息完成，session 状态:', result.status, '，是否继续轮询:', result.shouldContinue);

    return { status: result.status, shouldContinue: result.shouldContinue };
  }, [apiPrefix, sessionId, fetchAndUpdateMessages]);

  // 更新 fetchMessages ref - 立即设置，不等待 useEffect
  fetchMessagesRef.current = fetchMessages;

  // 轮询消息（带延时）- 使用 ref 避免依赖项变化导致重新创建
  const pollMessagesWithDelayRef = useRef<((delay?: number) => Promise<void>) | null>(null);
  const pollMessagesWithDelay = useCallback(
    async (delay: number = 3000) => {
      // 检查是否应该继续轮询（在检查 isPollingRef 之前先检查 shouldPollRef）
      if (!shouldPollRef.current) {
        isPollingRef.current = false;
        return;
      }

      // 注意：允许在 shouldPollRef 为 true 时继续，即使 isPollingRef 也为 true
      // 因为可能是在等待 timeout 期间，新的轮询请求来了
      // 但我们仍然需要防止真正的并发执行
      if (isPollingRef.current) {
        console.log('[ChatSession] 轮询正在执行中，等待当前请求完成');
        // 不直接返回，而是等待一小段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!shouldPollRef.current) {
          return;
        }
      }

      // 清除之前的 timeout
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }

      // 等待指定延时
      await new Promise<void>(resolve => {
        pollingTimeoutRef.current = setTimeout(() => {
          pollingTimeoutRef.current = null;
          resolve();
        }, delay);
      });

      // 检查是否应该继续轮询
      if (!shouldPollRef.current) {
        isPollingRef.current = false;
        return;
      }

      // 使用 ref 中的最新函数
      const fetchFn = fetchMessagesRef.current;
      if (!fetchFn) {
        isPollingRef.current = false;
        return;
      }

      isPollingRef.current = true;
      const { status, shouldContinue } = await fetchFn();
      isPollingRef.current = false;

      if (!shouldContinue) {
        // 状态为 idle 或 failed，停止轮询
        console.log('[ChatSession] session 状态为', status, '，停止轮询');
        shouldPollRef.current = false;
        setSessionLoading(sessionId, false);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (pollingTimeoutRef.current) {
          clearTimeout(pollingTimeoutRef.current);
          pollingTimeoutRef.current = null;
        }
        return;
      }

      // 继续轮询，递归调用
      if (shouldPollRef.current) {
        // 通过 ref 递归调用，确保使用最新的函数
        const pollFn = pollMessagesWithDelayRef.current;
        if (pollFn) {
          pollFn(delay);
        }
      }
    },
    [sessionId, setSessionLoading], // 需要 sessionId 和 setSessionLoading
  );

  // 更新 ref - 立即设置，不等待 useEffect
  pollMessagesWithDelayRef.current = pollMessagesWithDelay;

  // 初始化时检查 session 状态，如果正在处理中，自动开始轮询
  useEffect(() => {
    let mounted = true;

    const checkInitialStatus = async () => {
      // 停止之前的轮询
      shouldPollRef.current = false;
      isPollingRef.current = false;
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }

      // 等待一小段时间，确保 ref 已经设置好
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        const fetchFn = fetchMessagesRef.current;
        if (!fetchFn) {
          console.warn('[ChatSession] fetchMessages ref 未设置，无法检查状态');
          return;
        }

        const { status, shouldContinue } = await fetchFn();
        console.log('[ChatSession] 初始化检查，session 状态:', status, '，应该继续:', shouldContinue);
        if (mounted && shouldContinue) {
          console.log('[ChatSession] 检测到会话正在处理中，开始轮询');
          setSessionLoading(sessionId, true);
          shouldPollRef.current = true;
          // 通过 ref 调用，确保使用最新的函数
          const pollFn = pollMessagesWithDelayRef.current;
          if (pollFn) {
            pollFn(3000);
          } else {
            console.warn('[ChatSession] pollMessagesWithDelay ref 未设置，无法开始轮询');
          }
        }
      } catch (error) {
        console.error('[ChatSession] 初始化状态检查失败:', error);
      }
    };

    // 只在组件挂载时检查一次
    checkInitialStatus();

    return () => {
      mounted = false;
      shouldPollRef.current = false; // 停止轮询
      isPollingRef.current = false;
      setSessionLoading(sessionId, false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, [sessionId, setSessionLoading]); // 只依赖 sessionId，使用 ref 访问最新函数

  // 处理中断请求
  const handleCancel = useCallback(async () => {
    try {
      const response = await fetch(`${apiPrefix}/chat/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to cancel: ${response.status}`);
      }

      // 停止轮询
      shouldPollRef.current = false;
      setSessionLoading(sessionId, false);

      // 立即获取最新消息状态，并等待一小段时间确保状态更新
      const fetchFn = fetchMessagesRef.current;
      if (fetchFn) {
        await fetchFn();
      }

      // 等待一小段时间，确保后端状态已更新
      await new Promise(resolve => setTimeout(resolve, 500));

      // 再次获取状态，确保状态已更新为 idle
      if (fetchFn) {
        await fetchFn();
      }
    } catch (error) {
      console.error('[ChatSession] 中断失败:', error);
      toast.error('中断失败: ' + (error as Error).message);
    }
  }, [sessionId, apiPrefix, setSessionLoading]);

  // 使用发送消息 hook
  const { sendMessage: handleSendMessage } = useChatSendMessage({
    sessionId,
    apiPrefix,
    selectedModel,
    isLoading,
    fetchMessagesRef,
    shouldPollRef,
    pollMessagesWithDelayRef,
    lastMessageIdRef,
    controlledInputValue,
    onInputValueChange,
  });

  // 判断是否需要显示思考中消息
  const shouldShowThinkingMessage = useMemo(() => {
    if (!isLoading || messages.length === 0) {
      return false;
    }
    const lastMessage = messages[messages.length - 1];
    // 最后一条消息是 user 消息，且正在加载中
    return lastMessage && lastMessage.role === 'user';
  }, [messages, isLoading]);

  // 当显示/隐藏思考中消息时也滚动到底部
  const shouldShowThinkingMessageRef = useRef(shouldShowThinkingMessage);
  useEffect(() => {
    if (shouldShowThinkingMessage !== shouldShowThinkingMessageRef.current) {
      shouldShowThinkingMessageRef.current = shouldShowThinkingMessage;
      if (shouldShowThinkingMessage) {
        // 延迟一点确保 DOM 已更新
        setTimeout(() => scrollToBottom(), 100);
      }
    }
  }, [shouldShowThinkingMessage, scrollToBottom]);

  // A2UI 事件处理：将事件转换为用户消息发送给 Agent
  const handleA2UIEvent = useCallback(
    (event: { messageId: string; type: string; componentId: string; data?: Record<string, unknown> }) => {
      // 构建发送给 Agent 的消息
      const eventDescription = `用户与 A2UI 界面交互：
- 消息 ID: ${event.messageId}
- 组件 ID: ${event.componentId}
- 事件类型: ${event.type}
- 事件数据: ${JSON.stringify(event.data || {}, null, 2)}

此事件已自动处理，Agent 会根据事件数据继续执行后续逻辑。`;

      handleSendMessage(eventDescription);
    },
    [handleSendMessage],
  );

  // 计算总 token 数
  const totalTokenCount = useMemo(() => {
    return messages.reduce((sum, msg) => {
      return sum + (msg.tokenCount ?? 0);
    }, 0);
  }, [messages]);

  // 使用 useMemo 优化消息列表渲染
  const messagesList = useMemo(
    () => (
      <A2UIProvider sessionId={sessionId} apiPrefix={apiPrefix} onEvent={handleA2UIEvent}>
        <div className="min-w-0 space-y-0">
          {messages.map(message => (
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
            />
          ))}
          {shouldShowThinkingMessage && <ThinkingMessage modelId={selectedModel?.id} />}
          <div ref={messagesEndRef} />
        </div>
      </A2UIProvider>
    ),
    [messages, shouldShowThinkingMessage, selectedModel?.id, sessionId, apiPrefix, handleA2UIEvent],
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-4 opacity-50">
            <ThemeLogo width={64} height={64} alt="HeyFun" />
            <div className="flex flex-col">
              <div className="text-2xl font-bold">HeyFun</div>
              <div className="text-muted-foreground text-sm">Hey! Let&apos;s bring a little fun to this world together.</div>
            </div>
          </div>
        ) : (
          messagesList
        )}
      </div>

      {/* Input */}
      <ChatInput
        usage={usage}
        onSend={handleSendMessage}
        disabled={isLoading || disabled}
        inputValue={inputValue}
        onInputValueChange={handleInputValueChange}
        attachments={attachments}
        onAttachmentsChange={handleAttachmentsChange}
        isLoading={isLoading}
        onCancel={handleCancel}
      />
    </div>
  );
}
