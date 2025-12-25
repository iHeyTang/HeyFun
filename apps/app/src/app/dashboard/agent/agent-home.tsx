'use client';

import { ChatInputAttachment } from '@/components/block/chat-input/index';
import { buildMessageContent } from '@/components/features/chat/build-message-content';
import { ChatInput, useChatbotModelSelector } from '@/components/features/chat/chat-input';
import { Badge } from '@/components/ui/badge';
import { useChatSessionsStore } from '@/hooks/use-chat-sessions';
import { useState } from 'react';
import { toast } from 'sonner';

interface AgentHomeProps {
  apiPrefix?: string;
  onCreateSession?: () => void;
}

const examplePrompts = [
  {
    title: '代码生成',
    prompt: '帮我写一个 React 组件，实现一个可复用的按钮组件',
  },
  {
    title: '问题解答',
    prompt: '解释一下什么是 ReAct 模式，以及它在 AI Agent 中的应用',
  },
  {
    title: '数据分析',
    prompt: '分析这段代码的性能，并提供优化建议',
  },
  {
    title: '创意写作',
    prompt: '写一篇关于 AI 技术发展的文章，包含未来展望',
  },
  {
    title: '工具使用',
    prompt: '帮我搜索一下最新的 AI 技术趋势',
  },
  {
    title: '代码审查',
    prompt: '帮我审查这段代码，找出潜在的问题和改进点',
  },
];

export const AgentHome = ({ apiPrefix = '/api/agent', onCreateSession }: AgentHomeProps) => {
  const { createSession, setActiveSessionId, activeSessionId, fetchAndUpdateMessages } = useChatSessionsStore();
  const { selectedModel } = useChatbotModelSelector();
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<ChatInputAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);

  const handleExampleClick = (prompt: string) => {
    setInputValue(prompt);
  };

  const handleSend = async (message: string, messageAttachments?: ChatInputAttachment[]) => {
    if (!selectedModel) {
      toast.error('请先选择模型');
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage && (!messageAttachments || messageAttachments.length === 0) && attachments.length === 0) {
      return;
    }

    setIsSending(true);
    try {
      // 如果已有 activeSessionId，使用它；否则创建新 session
      let sessionId: string;
      if (activeSessionId) {
        sessionId = activeSessionId;
      } else {
        const session = await createSession({ title: 'New Chat' });
        if (!session) {
          throw new Error('Failed to create session');
        }
        sessionId = session.id;
        // 设置活动 session
        setActiveSessionId(session.id);
      }

      // 使用传入的 attachments 或当前的 attachments
      const finalAttachments = messageAttachments || attachments;
      // 构建消息内容
      const messageContent = buildMessageContent(trimmedMessage, finalAttachments.length > 0 ? finalAttachments : undefined);

      // 发送消息到后端
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

      // 发送成功后，立即获取消息，以便界面切换到 ChatSession
      try {
        await fetchAndUpdateMessages({ sessionId, apiPrefix });
      } catch (error) {
        console.error('Failed to fetch messages after sending:', error);
        // 不阻止流程，继续执行
      }

      // 清空输入
      setInputValue('');
      setAttachments([]);

      if (onCreateSession) {
        onCreateSession();
      }
    } catch (error) {
      toast.error('发送消息失败');
      console.error('Send message error:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto px-4 py-8">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        {/* 欢迎区域 */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl">今天想做点什么？</h1>
          </div>
        </div>

        {/* 输入框 */}
        <div className="flex flex-col gap-4">
          <ChatInput
            onSend={handleSend}
            disabled={isSending}
            inputValue={inputValue}
            onInputValueChange={setInputValue}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            isLoading={isSending}
            className="pb-0"
          />
          <div className="flex flex-wrap gap-2">
            {examplePrompts.map((example, index) => (
              <Badge
                key={index}
                variant="outline"
                className="hover:bg-accent hover:text-accent-foreground cursor-pointer"
                onClick={() => handleExampleClick(example.prompt)}
              >
                {example.title}
              </Badge>
            ))}
          </div>
        </div>

        {/* 提示信息 */}
        {!selectedModel && <div className="text-muted-foreground text-center text-xs">请先选择一个模型以开始对话</div>}
      </div>
    </div>
  );
};
