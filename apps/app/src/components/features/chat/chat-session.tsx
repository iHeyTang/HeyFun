/**
 * ChatSession 组件
 * 内层组件：只负责维护一个 session 内的对话
 */

'use client';

import { ThemeLogo } from '@/components/features/theme-logo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChatInput, useChatbotModelSelector } from './chat-input';
import type { ChatInputAttachment } from '@/components/block/chat-input/index';
import { ChatMessage as ChatMessageComponent } from './chat-message';
import { ChatMessages } from '@prisma/client';

interface ChatSessionProps {
  /** 必需的 sessionId */
  sessionId: string;
  /** 初始消息列表 */
  initialMessages?: ChatMessages[];
  /** 是否禁用输入 */
  disabled?: boolean;
  /** 清空对话回调 */
  onClearChat?: () => void;
  /** 消息更新回调（用于本地存储） */
  onMessagesChange?: (messages: ChatMessages[]) => void;
  /** API 端点前缀（可选，默认 '/api/agent'） */
  apiPrefix?: string;
  /** 标题更新回调 */
  onTitleUpdated?: (title: string) => void;
}

/**
 * ChatSession 组件
 * 只负责在一个已存在的 session 中进行对话
 */
export function ChatSession({
  sessionId,
  initialMessages = [],
  disabled = false,
  onClearChat,
  onMessagesChange,
  apiPrefix = '/api/agent',
  onTitleUpdated,
}: ChatSessionProps) {
  const [messages, setMessages] = useState<ChatMessages[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const shouldPollRef = useRef<boolean>(false);
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

  // 同步外部传入的消息
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // 通知外部消息变化 - 使用 useCallback 优化
  const handleMessagesChange = useCallback(
    (newMessages: ChatMessages[]) => {
      onMessagesChange?.(newMessages);
    },
    [onMessagesChange],
  );

  useEffect(() => {
    if (messages.length > 0 && messages !== initialMessages) {
      handleMessagesChange(messages);
    }
  }, [messages, initialMessages, handleMessagesChange]);

  // 获取消息并更新状态
  const fetchMessages = useCallback(async (): Promise<{ status: string; shouldContinue: boolean }> => {
    try {
      const url = new URL(`${apiPrefix}/messages`, window.location.origin);
      url.searchParams.set('sessionId', sessionId);
      url.searchParams.set('limit', '100'); // 获取更多消息以确保完整性

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data: { messages: ChatMessages[]; status: string; title: string } = await response.json();
      const rawMessages = data.messages || [];

      // 获取处理状态和标题
      const sessionStatus = data.status || 'idle';
      const sessionTitle = data.title;

      // 如果标题有更新，调用回调
      if (sessionTitle) {
        onTitleUpdated?.(sessionTitle);
      }

      // 处理消息：从 toolResults 读取工具结果
      const processedMessages: ChatMessages[] = [];
      for (const msg of rawMessages) {
        if (!msg) continue;

        // 跳过 role='tool' 的消息，它们已经作为 toolResults 存储在 assistant 消息中
        if (msg.role === 'tool') {
          continue;
        }

        // 只处理 user 和 assistant 消息
        if (msg.role !== 'user' && msg.role !== 'assistant') {
          continue;
        }

        const chatMessage: ChatMessages = msg;

        // 如果这是一个有 toolCalls 的 assistant 消息，从 toolResults 读取工具结果
        if (msg.role === 'assistant' && msg.toolCalls && msg.toolResults) {
          const toolCalls = msg.toolCalls as any[];
          const toolResults = msg.toolResults as any[];
          const processedToolResults: any[] = [];

          // 处理每个工具结果
          for (const toolResult of toolResults) {
            const toolCallId = toolResult.toolCallId;
            const toolCall = toolCalls.find((tc: any) => tc.id === toolCallId);

            // 提取工具结果数据
            const resultData = {
              toolName: toolCall?.function?.name || 'unknown',
              success: toolResult.success ?? true,
              data: toolResult.data,
              error: toolResult.error,
              message: toolResult.message,
            };

            processedToolResults.push(resultData);
          }

          if (processedToolResults.length > 0) {
            chatMessage.toolResults = processedToolResults;
          }
        }

        processedMessages.push(chatMessage);
      }

      // 更新消息列表
      if (processedMessages.length > 0) {
        setMessages(prev => {
          // 创建消息映射，以ID为key
          const messageMap = new Map<string, ChatMessages>();
          prev.forEach(msg => messageMap.set(msg.id, msg));

          // 更新或添加消息
          processedMessages.forEach((newMsg: ChatMessages) => {
            const existing = messageMap.get(newMsg.id);
            // 确保 createdAt 是 Date 对象
            const createdAtDate = newMsg.createdAt instanceof Date ? newMsg.createdAt : new Date(newMsg.createdAt);

            if (existing) {
              // 更新现有消息（保留 toolResults 等前端状态）
              messageMap.set(newMsg.id, {
                ...existing,
                ...newMsg,
                createdAt: createdAtDate,
                // 如果新消息有 toolResults，更新它
                toolResults: newMsg.toolResults || existing.toolResults,
              });
            } else {
              // 添加新消息
              messageMap.set(newMsg.id, {
                ...newMsg,
                createdAt: createdAtDate,
              });
            }
          });

          // 转换为数组并按时间排序
          const sortedMessages = Array.from(messageMap.values()).sort((a, b) => {
            const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
            const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
            return timeA - timeB;
          });

          // 更新最后一条消息ID
          if (sortedMessages.length > 0) {
            lastMessageIdRef.current = sortedMessages[sortedMessages.length - 1]!.id;
          }

          return sortedMessages;
        });
      }

      // 基于处理状态判断是否继续轮询
      // idle: 空闲状态，处理完成，停止轮询
      // failed: 处理失败，停止轮询
      // pending/processing: 正在处理中，继续轮询
      const shouldContinue = sessionStatus === 'pending' || sessionStatus === 'processing';

      console.log('[ChatSession] 获取消息完成，session 状态:', sessionStatus, '，是否继续轮询:', shouldContinue);

      return { status: sessionStatus, shouldContinue };
    } catch (error) {
      console.error('[ChatSession] 获取消息失败:', error);
      // 出错时继续轮询，避免因网络问题导致轮询停止
      return { status: 'unknown', shouldContinue: true };
    }
  }, [apiPrefix, sessionId, onTitleUpdated]);

  // 轮询消息（带延时）
  const pollMessagesWithDelay = useCallback(
    async (delay: number = 3000) => {
      // 等待指定延时
      await new Promise(resolve => setTimeout(resolve, delay));

      // 检查是否应该继续轮询
      if (!shouldPollRef.current) {
        return;
      }

      const { status, shouldContinue } = await fetchMessages();

      if (!shouldContinue) {
        // 状态为 idle 或 failed，停止轮询
        console.log('[ChatSession] session 状态为', status, '，停止轮询');
        shouldPollRef.current = false;
        setIsLoading(false);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        return;
      }

      // 继续轮询，递归调用
      if (shouldPollRef.current) {
        pollMessagesWithDelay(delay);
      }
    },
    [fetchMessages],
  );

  const handleSendMessage = useCallback(
    async (content: string, attachments?: ChatInputAttachment[]) => {
      // 构建多模态内容（文本和附件一起发送）
      let messageContent: string;
      if (attachments && attachments.length > 0) {
        // 如果有附件，构建多模态内容格式
        const contentParts: Array<
          | { type: 'text'; text: string }
          | { type: 'image_url'; image_url: { url: string } }
          | { type: 'attachment'; attachment: { fileKey: string; type: string; name?: string; mimeType?: string } }
        > = [];

        // 添加文本内容（如果有）
        if (content.trim()) {
          contentParts.push({ type: 'text', text: content });
        }

        // 添加附件内容
        for (const attachment of attachments) {
          if (attachment.type === 'image') {
            // 图片类型，使用 image_url 格式（用于 LLM 视觉能力）
            let imageUrl: string;
            if (attachment.fileKey) {
              // 使用特殊格式标识OSS key
              imageUrl = `oss://${attachment.fileKey}`;
            } else if (attachment.url.startsWith('data:image')) {
              // 已经是base64，直接使用
              imageUrl = attachment.url;
            } else {
              // 其他URL，转换为绝对URL
              imageUrl = attachment.url.startsWith('http') ? attachment.url : `${window.location.origin}${attachment.url}`;
            }
            contentParts.push({
              type: 'image_url',
              image_url: { url: imageUrl },
            });
          } else {
            // 非图片附件，使用 attachment 格式
            if (attachment.fileKey) {
              contentParts.push({
                type: 'attachment',
                attachment: {
                  fileKey: attachment.fileKey,
                  type: attachment.type,
                  name: attachment.name,
                  mimeType: attachment.mimeType,
                },
              });
            }
          }
        }

        // 将多模态内容序列化为JSON字符串
        messageContent = JSON.stringify(contentParts);
      } else {
        // 纯文本消息
        messageContent = content;
      }

      // 调用后端 API
      setIsLoading(true);
      console.log('[ChatSession] 发送消息，开始加载...');

      try {
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
        };
        setMessages(prev => [...prev, tempUserMessage]);

        // 发送消息到后端，触发 workflow
        if (!selectedModel) {
          toast.error('Please select a model first');
          setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp_')));
          setIsLoading(false);
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

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to send message: ${response.status}`);
        }

        const data = await response.json();
        console.log('[ChatSession] 消息发送成功，userMessageId:', data.userMessageId, 'workflowRunId:', data.workflowRunId);

        // 更新临时用户消息ID
        if (data.userMessageId) {
          setMessages(prev => prev.map(msg => (msg.id === tempUserMessage.id ? { ...msg, id: data.userMessageId } : msg)));
          lastMessageIdRef.current = data.userMessageId;
        }

        // 立即请求一次 messages，获取最新状态
        const { status, shouldContinue } = await fetchMessages();
        console.log('[ChatSession] 首次获取消息，session 状态:', status);

        if (!shouldContinue) {
          // 如果状态已经是 idle 或 failed，直接停止加载
          console.log('[ChatSession] session 状态为', status, '，无需轮询');
          shouldPollRef.current = false;
          setIsLoading(false);
        } else {
          // 状态为 pending 或 processing，开始轮询（带延时）
          console.log('[ChatSession] session 状态为', status, '，开始轮询');
          shouldPollRef.current = true;
          pollMessagesWithDelay(3000); // 3秒后开始下一次请求
        }
      } catch (error) {
        console.error('[ChatSession] 发送消息失败:', error);
        toast.error('发送消息失败: ' + (error as Error).message);

        // 移除临时消息
        setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp_')));
        shouldPollRef.current = false;
        setIsLoading(false);
      }
    },
    [sessionId, apiPrefix, fetchMessages, pollMessagesWithDelay, selectedModel],
  );

  // 使用 useMemo 优化消息列表渲染
  const messagesList = useMemo(
    () => (
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
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
    ),
    [messages],
  );

  // 使用 useCallback 优化回调函数
  const handleClearChatCallback = useCallback(() => {
    onClearChat?.();
  }, [onClearChat]);

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
        onSend={handleSendMessage}
        disabled={isLoading || disabled}
        onClearChat={handleClearChatCallback}
        showClearChat={messages.length > 0}
      />
    </div>
  );
}
