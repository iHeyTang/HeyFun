'use client';

import { getTask, createTask, terminateTask } from '@/actions/tasks';
import { ChatInput } from '@/components/features/chat/input';
import { useModelSelectorStore } from '@/components/features/model-selector';
import { useInputToolsConfig } from '@/components/features/chat/input/config-tools';
import { ChatMessages } from '@/components/features/chat/messages';
import { ChatPreview } from '@/components/features/chat/preview';
import { usePreviewData } from '@/components/features/chat/preview/preview-content/workspace-preview';
import { aggregateMessages } from '@/lib/browser/chat-messages';
import { Message } from '@/lib/browser/chat-messages/types';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskid as string;

  const { setData: setPreviewData } = usePreviewData();

  const [isNearBottom, setIsNearBottom] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { selectedModel } = useModelSelectorStore('chat-input-model-storage');
  const { enabledTools } = useInputToolsConfig();

  const shouldAutoScroll = isNearBottom;

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
      setIsNearBottom(isNearBottom);
    }
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current && shouldAutoScroll) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const refreshTask = async () => {
    const res = await getTask({ taskId });
    if (res.error || !res.data) {
      console.error('Error fetching task:', res.error);
      return;
    }
    setMessages(res.data.progresses.map(step => ({ ...step, index: step.index! || 0, type: step.type as any, role: 'assistant' as const })));
    if (shouldAutoScroll) {
      requestAnimationFrame(scrollToBottom);
      const nextMessage = messages[messages.length - 1];
      if (shouldAutoScroll) {
        if (nextMessage?.type === 'agent:lifecycle:step:think:browser:browse:complete') {
          setPreviewData({
            type: 'browser',
            url: nextMessage.content.url,
            title: nextMessage.content.title,
            screenshot: nextMessage.content.screenshot,
          });
        }
        if (nextMessage?.type === 'agent:lifecycle:step:act:tool:execute:start') {
          setPreviewData({ type: 'tool', executionId: nextMessage.content.id });
        }
      }
    }
    setIsThinking(res.data!.status !== 'completed' && res.data!.status !== 'failed' && res.data!.status !== 'terminated');
    setIsTerminating(res.data!.status === 'terminating');
  };

  useEffect(() => {
    setPreviewData(null);
    if (!taskId) return;
    refreshTask();
  }, [taskId]);

  useEffect(() => {
    refreshTask();
    if (!taskId || !isThinking) return;
    const interval = setInterval(refreshTask, 2000);
    return () => {
      clearInterval(interval);
    };
  }, [taskId, isThinking, shouldAutoScroll]);

  useEffect(() => {
    if (shouldAutoScroll) {
      requestAnimationFrame(scrollToBottom);
    }
  }, [messages, shouldAutoScroll]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = async (value: { prompt: string; files: File[]; shouldPlan: boolean }) => {
    try {
      const res = await createTask({
        taskId,
        modelId: selectedModel?.id || '',
        modelProvider: selectedModel?.provider || '',
        prompt: value.prompt,
        toolIds: enabledTools,
        files: value.files,
        shouldPlan: value.shouldPlan,
      });
      if (res.error) {
        console.error('Error restarting task:', res.error);
      }
      setIsThinking(true);
      router.refresh();
    } catch (error) {
      console.error('Error submitting task:', error);
    }
  };

  return (
    <div className="flex h-full w-full flex-row justify-between">
      <div className="flex h-full flex-1 flex-col">
        <div
          ref={messagesContainerRef}
          className="h-[calc(100vh-250px)] space-y-4 p-4 pb-0"
          style={{
            scrollBehavior: 'smooth',
            overscrollBehavior: 'contain',
          }}
          onScroll={handleScroll}
        >
          <ChatMessages messages={aggregateMessages(messages)} />
        </div>
        <ChatInput
          status={isThinking ? 'thinking' : isTerminating ? 'terminating' : 'completed'}
          onSubmit={handleSubmit}
          onTerminate={async () => {
            await terminateTask({ taskId });
            router.refresh();
          }}
          taskId={taskId}
        />
      </div>
      <div className="min-w-[400px] flex-1 items-center justify-center p-2">
        <ChatPreview taskId={taskId} messages={messages} />
      </div>
    </div>
  );
}
