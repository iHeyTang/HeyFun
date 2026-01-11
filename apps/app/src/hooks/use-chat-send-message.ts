import { useCallback } from 'react';
import { toast } from 'sonner';
import { ChatMessages } from '@prisma/client';
import { ChatInputAttachment } from '@/components/block/chat-input';
import { useChatSessionsStore, useChatMessagesStore } from './use-chat-sessions';
import { ModelInfo } from '@/llm/chat';
import { buildMessageContent } from '@/components/features/chat/build-message-content';

interface UseChatSendMessageOptions {
  sessionId: string;
  selectedModel: ModelInfo | null;
  isLoading: boolean;
}

/**
 * 发送消息 Hook
 * 封装发送消息的完整逻辑，包括状态检查、内容构建和 API 调用
 */
export const useChatSendMessage = ({ sessionId, selectedModel, isLoading }: UseChatSendMessageOptions) => {
  const { setSessionLoading, addMessageToSession, setSessionMessages, setSessionInputValue } = useChatSessionsStore();

  /**
   * 发送消息
   * 只负责发送消息到后端，返回发送结果
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
          metadata: null,
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

        const response = await fetch(`/api/agent/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, content: messageContent, modelId: selectedModel.id }),
        });

        // 清空输入框
        setSessionInputValue(sessionId, '');

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to send message: ${response.status}`);
        }

        const data = await response.json();
        console.log('[useSendMessage] 消息发送成功，userMessageId:', data.userMessageId, 'workflowRunId:', data.workflowRunId);

        // 发送成功，返回结果（loading 状态由调用方管理）
        return data;
      } catch (error) {
        console.error('[useSendMessage] 发送消息失败:', error);
        toast.error('发送消息失败: ' + (error as Error).message);

        // 移除临时消息
        const { sessionMessages: currentMessages } = useChatMessagesStore.getState();
        setSessionMessages(
          sessionId,
          (currentMessages[sessionId] || []).filter((msg: ChatMessages) => !msg.id.startsWith('temp_')),
        );
        setSessionLoading(sessionId, false);
        throw error;
      }
    },
    [sessionId, selectedModel, isLoading, setSessionLoading, addMessageToSession, setSessionMessages, setSessionInputValue],
  );

  return { sendMessage };
};
