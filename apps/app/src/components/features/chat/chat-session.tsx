/**
 * ChatSession 组件
 * 内层组件：只负责维护一个 session 内的对话
 */

'use client';

import { ThemeLogo } from '@/components/features/theme-logo';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChatInput } from './chat-input';
import { ChatMessage as ChatMessageComponent } from './chat-message';
import { createToolExecutor, type ToolExecutionContext } from '@/agents/browser';
import type { ToolCall, ToolResult, ChatMessage as Message } from './types';

interface ChatSessionProps {
  /** 必需的 sessionId */
  sessionId: string;
  /** 初始消息列表 */
  initialMessages?: Message[];
  /** 是否禁用输入 */
  disabled?: boolean;
  /** 清空对话回调 */
  onClearChat?: () => void;
  /** 消息更新回调（用于本地存储） */
  onMessagesChange?: (messages: Message[]) => void;
  /** 工具执行上下文（包含 canvasRef 等） */
  toolExecutionContext?: ToolExecutionContext;
  /** API 端点前缀（可选，默认 '/api/chat'，FlowCanvas 使用 '/api/flowcanvas/agent'） */
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
  toolExecutionContext,
  apiPrefix = '/api/chat',
  onTitleUpdated,
}: ChatSessionProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [toolExecutor] = useState(() => createToolExecutor());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 同步外部传入的消息
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // 通知外部消息变化
  useEffect(() => {
    if (messages.length > 0 && messages !== initialMessages) {
      onMessagesChange?.(messages);
    }
  }, [messages, onMessagesChange]);

  // 执行工具调用并获取 AI 后续响应
  const executeToolsAndContinue = async (messageId: string, toolCalls: ToolCall[]) => {
    if (!toolCalls || toolCalls.length === 0) {
      return;
    }

    try {
      // 执行工具
      const context = toolExecutionContext || {};
      const results = await toolExecutor.executeMany(toolCalls, context);

      // 构建工具结果对象
      const toolResults: ToolResult[] = results.map((r, i) => ({
        toolName: toolCalls[i]?.function?.name || 'unknown',
        success: r.success,
        data: r.data,
        error: r.error,
        message: r.message,
      }));

      // 将工具执行结果附加到原消息上
      setMessages(prev =>
        prev.map(msg => (msg.id === messageId ? { ...msg, toolResults } : msg)),
      );

      // 提交工具结果到后端，获取 AI 的后续响应
      const response = await fetch(`${apiPrefix}/tool-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          messageId,
          toolResults: toolCalls.map((tc, i) => ({
            toolCallId: tc.id,
            result: results[i],
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit tool results');
      }

      // 处理 AI 的后续响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        let aiMessageId: string | null = null;

        // 添加新的 AI 响应占位
        const continueMessage: Message = {
          id: `temp_continue_${Date.now()}`,
          role: 'assistant',
          content: '',
          isStreaming: true,
          isComplete: false,
          createdAt: new Date(),
        };
        setMessages(prev => [...prev, continueMessage]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const parsed = JSON.parse(data);

                if (parsed.type === 'init') {
                  aiMessageId = parsed.aiMessageId;
                  setMessages(prev =>
                    prev.map(msg => (msg.id === continueMessage.id ? { ...msg, id: aiMessageId! } : msg)),
                  );
                } else if (parsed.type === 'content' && aiMessageId) {
                  setMessages(prev =>
                    prev.map(msg => (msg.id === aiMessageId ? { ...msg, content: parsed.fullContent } : msg)),
                  );
                } else if (parsed.type === 'tool_calls' && aiMessageId) {
                  // 接收到工具调用，先更新消息
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === aiMessageId
                        ? { ...msg, content: parsed.fullContent, toolCalls: parsed.toolCalls, isStreaming: false, isComplete: true }
                        : msg,
                    ),
                  );

                  // 执行工具调用并继续对话
                  await executeToolsAndContinue(aiMessageId, parsed.toolCalls);
                } else if (parsed.type === 'finished' && aiMessageId) {
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === aiMessageId ? { ...msg, content: parsed.fullContent, isStreaming: false, isComplete: true } : msg,
                    ),
                  );
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      }

      toast.success(`工具执行完成`);
    } catch (error) {
      console.error('Tool execution error:', error);
      toast.error('工具执行失败: ' + (error as Error).message);
    }
  };

  const handleSendMessage = async (content: string) => {
    // 检查是否是本地 session（以 local_ 开头）
    const isLocalSession = sessionId.startsWith('local_');
    
    if (isLocalSession) {
      // 本地模式：不调用后端 API，直接添加消息
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content,
        isComplete: true,
        createdAt: new Date(),
      };
      
      const aiMessage: Message = {
        id: `msg_ai_${Date.now()}`,
        role: 'assistant',
        content: '本地模式暂时不支持 AI 响应，请使用 remote 模式。',
        isComplete: true,
        createdAt: new Date(),
      };
      
      setMessages(prev => [...prev, userMessage, aiMessage]);
      return;
    }

    // 远程模式：调用后端 API
    setIsLoading(true);

    try {
      // 添加临时用户消息
      const tempUserMessage: Message = {
        id: `temp_user_${Date.now()}`,
        role: 'user',
        content,
        isComplete: true,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, tempUserMessage]);

      // 添加临时 AI 消息占位
      const tempAiMessage: Message = {
        id: `temp_ai_${Date.now()}`,
        role: 'assistant',
        content: '',
        isStreaming: true,
        isComplete: false,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, tempAiMessage]);

      // 发送消息到后端
      const response = await fetch(`${apiPrefix}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          content,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get streaming response: ${response.status} ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        let realUserMessageId: string | null = null;
        let realAiMessageId: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                if (realAiMessageId) {
                  setMessages(prev => prev.map(msg => (msg.id === realAiMessageId ? { ...msg, isStreaming: false, isComplete: true } : msg)));
                }
                break;
              }

              try {
                const parsed = JSON.parse(data);

                if (parsed.type === 'init') {
                  realUserMessageId = parsed.userMessageId;
                  realAiMessageId = parsed.aiMessageId;

                  setMessages(prev =>
                    prev.map(msg => {
                      if (msg.id === tempUserMessage.id) {
                        return { ...msg, id: realUserMessageId! };
                      }
                      if (msg.id === tempAiMessage.id) {
                        return { ...msg, id: realAiMessageId! };
                      }
                      return msg;
                    }),
                  );
                } else if (parsed.type === 'content' && realAiMessageId) {
                  setMessages(prev => prev.map(msg => (msg.id === realAiMessageId ? { ...msg, content: parsed.fullContent } : msg)));
                } else if (parsed.type === 'tool_calls' && realAiMessageId) {
                  // 接收到工具调用，先更新消息
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === realAiMessageId
                        ? { ...msg, content: parsed.fullContent, toolCalls: parsed.toolCalls, isStreaming: false, isComplete: true }
                        : msg,
                    ),
                  );

                  // 执行工具调用并继续对话
                  await executeToolsAndContinue(realAiMessageId, parsed.toolCalls);
                } else if (parsed.type === 'finished' && realAiMessageId) {
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === realAiMessageId ? { ...msg, content: parsed.fullContent, isStreaming: false, isComplete: true } : msg,
                    ),
                  );
                } else if (parsed.type === 'title_updated') {
                  // 标题已更新，通知父组件
                  console.log('[ChatSession] 📝 Title updated:', parsed.title);
                  onTitleUpdated?.(parsed.title);
                } else if (parsed.type === 'error') {
                  if (realAiMessageId) {
                    setMessages(prev =>
                      prev.map(msg =>
                        msg.id === realAiMessageId ? { ...msg, content: `Error: ${parsed.error}`, isStreaming: false, isComplete: true } : msg,
                      ),
                    );
                  }
                  toast.error('AI response error: ' + parsed.error);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to send message: ' + (error as Error).message);

      // 移除临时消息
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp_')));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-4 opacity-50">
            <ThemeLogo width={64} height={64} alt="HeyFun" />
            <div className="flex flex-col">
              <div className="text-2xl font-bold">HeyFun</div>
              <div className="text-muted-foreground text-sm">Hey! Let&apos;s bring a little fun to this world together.</div>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {messages.map(message => (
              <ChatMessageComponent 
                key={message.id} 
                role={message.role} 
                content={message.content} 
                isStreaming={message.isStreaming} 
                timestamp={message.createdAt}
                toolCalls={message.toolCalls}
                toolResults={message.toolResults}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSendMessage} disabled={isLoading || disabled} onClearChat={onClearChat} showClearChat={messages.length > 0} />
    </div>
  );
}
