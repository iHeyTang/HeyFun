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
    title: '生成React按钮组件',
    prompt: '帮我写一个 React 组件，实现一个可复用的按钮组件，支持多种尺寸和状态',
    category: '开发',
  },
  {
    title: '写诗',
    prompt: '写一首关于春天的现代诗，表达对自然和生命的感悟，语言优美有意境',
    category: '创作',
  },
  {
    title: '制定产品营销策略',
    prompt: '为我的新产品制定一份完整的营销策略，包括目标用户定位、推广渠道选择和营销活动方案',
    category: '商业',
  },
  {
    title: '设计日本7日旅行路线',
    prompt: '设计一条日本7日自由行路线，包括东京、京都、大阪三个城市，涵盖经典景点和美食推荐',
    category: '旅行',
  },
  {
    title: '规划健康饮食',
    prompt: '帮我规划一周的健康饮食菜单，包括早餐、午餐、晚餐，注重营养搭配和食材多样性',
    category: '生活',
  },
  {
    title: '解释量子纠缠现象',
    prompt: '用通俗易懂的方式解释什么是量子纠缠，包括它的基本原理、实验验证和实际应用',
    category: '科学',
  },
  {
    title: '优化React应用加载速度',
    prompt: '如何优化 React 应用的首次加载速度？包括代码分割、懒加载、资源压缩等具体方案',
    category: '开发',
  },
  {
    title: '分析投资风险',
    prompt: '分析一个包含股票、债券、基金的混合投资组合的风险水平，并提供优化建议',
    category: '金融',
  },
  {
    title: '制定英语学习计划',
    prompt: '为英语初学者制定一份3个月的学习计划，包括每日学习内容、练习方法和进度安排',
    category: '教育',
  },
  {
    title: '健身',
    prompt: '为想要增肌的健身新手制定一份6周的训练计划，包括训练安排、饮食建议和休息恢复',
    category: '健康',
  },
  {
    title: '设计品牌视觉识别系统',
    prompt: '为一个新品牌设计完整的视觉识别系统，包括Logo、色彩方案、字体选择和品牌应用规范',
    category: '设计',
  },
  {
    title: '分析用户行为',
    prompt: '分析电商平台用户的购买行为模式，包括浏览习惯、决策因素和转化路径',
    category: '心理学',
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
        <div className="flex flex-col gap-2">
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
          <div className="flex flex-wrap gap-2.5 px-6">
            {examplePrompts.map((example, index) => (
              <Badge
                key={index}
                variant="outline"
                className="border-border/60 bg-background/50 text-foreground/80 hover:border-border hover:bg-accent/80 hover:text-accent-foreground group relative cursor-pointer rounded-xl px-4 py-1.5 text-xs font-medium backdrop-blur-sm transition-all duration-300 active:scale-[0.98]"
                onClick={() => handleExampleClick(example.prompt)}
                title={example.prompt}
              >
                <span className="relative z-10">{example.title}</span>
                <span className="to-accent/5 absolute inset-0 rounded-xl bg-gradient-to-br from-transparent via-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
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
