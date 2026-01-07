import { useCallback } from 'react';
import { toast } from 'sonner';
import { ChatMessages } from '@prisma/client';
import { ChatInputAttachment } from '@/components/block/chat-input';
import { useChatSessionsStore, useChatMessagesStore } from './use-chat-sessions';
import { ModelInfo } from '@repo/llm/chat';
import { buildMessageContent } from '@/components/features/chat/build-message-content';

interface UseChatSendMessageOptions {
  sessionId: string;
  apiPrefix?: string;
  selectedModel: ModelInfo | null;
  isLoading: boolean;
  fetchMessagesRef: React.MutableRefObject<(() => Promise<{ status: string; shouldContinue: boolean }>) | undefined>;
  shouldPollRef: React.MutableRefObject<boolean>;
  pollMessagesWithDelayRef: React.MutableRefObject<((delay?: number) => Promise<void>) | null>;
  lastMessageIdRef: React.MutableRefObject<string | null>;
  controlledInputValue?: string;
  onInputValueChange?: (value: string) => void;
}

/**
 * 发送消息 Hook
 * 封装发送消息的完整逻辑，包括状态检查、内容构建、API 调用和轮询管理
 */
export const useChatSendMessage = ({
  sessionId,
  apiPrefix = '/api/agent',
  selectedModel,
  isLoading,
  fetchMessagesRef,
  shouldPollRef,
  pollMessagesWithDelayRef,
  lastMessageIdRef,
  controlledInputValue,
  onInputValueChange,
}: UseChatSendMessageOptions) => {
  const { setSessionLoading, addMessageToSession, setSessionMessages, setSessionInputValue } = useChatSessionsStore();

  /**
   * 发送消息
   */
  const sendMessage = useCallback(
    async (content: string, attachments?: ChatInputAttachment[]) => {
      // 立即设置 loading 状态，提供即时反馈
      setSessionLoading(sessionId, true);
      console.log('[useSendMessage] 发送消息，开始加载...');

      try {
        // 如果当前正在加载，不允许发送新消息
        if (isLoading) {
          toast.error('正在处理中，请先中断当前请求');
          setSessionLoading(sessionId, false);
          return;
        }

        // 发送前先检查 session 状态，确保不在处理中
        try {
          const fetchFn = fetchMessagesRef.current;
          const statusCheck = fetchFn ? await fetchFn() : { status: 'idle', shouldContinue: false };
          if (statusCheck.status === 'pending' || statusCheck.status === 'processing') {
            toast.error('会话正在处理中，请稍候或先中断当前请求');
            setSessionLoading(sessionId, false);
            return;
          }
        } catch (error) {
          console.error('[useSendMessage] 检查状态失败:', error);
          // 如果检查失败，继续发送，让后端处理（后端会再次检查）
        }

        // 构建消息内容
        const messageContent = buildMessageContent(content, attachments);

        // 添加临时用户消息
        const tempUserMessage: ChatMessages = {
          id: `temp_user_${Date.now()}`,
          role: 'user',
          content: messageContent,
          isComplete: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          sessionId,
          organizationId: '', // 临时消息，稍后会被真实消息替换
          isStreaming: false,
          tokenCount: null,
          finishReason: null,
          modelId: null,
          toolCalls: null,
          toolResults: null,
          inputTokens: null,
          outputTokens: null,
          cachedInputTokens: null,
          cachedOutputTokens: null,
          microAgentExecutions: null, // Prisma schema field, kept for type compatibility
        };
        addMessageToSession(sessionId, tempUserMessage);

        // 发送消息到后端，触发 workflow
        if (!selectedModel) {
          toast.error('Please select a model first');
          const { sessionMessages: currentMessages } = useChatMessagesStore.getState();
          setSessionMessages(
            sessionId,
            (currentMessages[sessionId] || []).filter((msg: ChatMessages) => !msg.id.startsWith('temp_')),
          );
          setSessionLoading(sessionId, false);
          return;
        }

        const response = await fetch(`${apiPrefix}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            content: messageContent,
            modelId: selectedModel.id,
          }),
        });

        // 清空输入框
        setSessionInputValue(sessionId, '');
        if (controlledInputValue !== undefined && onInputValueChange) {
          onInputValueChange('');
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to send message: ${response.status}`);
        }

        const data = await response.json();
        console.log('[useSendMessage] 消息发送成功，userMessageId:', data.userMessageId, 'workflowRunId:', data.workflowRunId);

        // 记录真实消息 ID，但不在此时更新临时消息 ID
        // 让 fetchAndUpdateMessages 用真实消息替换临时消息，避免时序问题
        if (data.userMessageId) {
          lastMessageIdRef.current = data.userMessageId;
        }

        // 立即请求一次 messages，获取最新状态
        const fetchFn = fetchMessagesRef.current;
        if (!fetchFn) {
          console.warn('[useSendMessage] fetchMessages ref 未设置，无法获取状态');
          setSessionLoading(sessionId, false);
          return;
        }
        const { status, shouldContinue } = await fetchFn();
        console.log('[useSendMessage] 发送消息后首次获取消息，session 状态:', status, '，应该继续:', shouldContinue);

        if (!shouldContinue) {
          // 如果状态已经是 idle 或 failed，直接停止加载
          console.log('[useSendMessage] session 状态为', status, '，无需轮询');
          shouldPollRef.current = false;
          setSessionLoading(sessionId, false);
        } else {
          // 状态为 pending 或 processing，开始轮询（带延时）
          console.log('[useSendMessage] session 状态为', status, '，开始轮询');
          shouldPollRef.current = true;
          // 通过 ref 调用，确保使用最新的函数
          const pollFn = pollMessagesWithDelayRef.current;
          if (pollFn) {
            pollFn(3000); // 3秒后开始下一次请求
          } else {
            console.warn('[useSendMessage] pollMessagesWithDelay ref 未设置，无法开始轮询');
            setSessionLoading(sessionId, false);
          }
        }
      } catch (error) {
        console.error('[useSendMessage] 发送消息失败:', error);
        toast.error('发送消息失败: ' + (error as Error).message);

        // 移除临时消息
        const { sessionMessages: currentMessages } = useChatMessagesStore.getState();
        setSessionMessages(
          sessionId,
          (currentMessages[sessionId] || []).filter((msg: ChatMessages) => !msg.id.startsWith('temp_')),
        );
        shouldPollRef.current = false;
        setSessionLoading(sessionId, false);
      }
    },
    [
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
      setSessionLoading,
      addMessageToSession,
      setSessionMessages,
      setSessionInputValue,
    ],
  );

  return { sendMessage };
};
