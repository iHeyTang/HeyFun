'use client';

import { getTask, createTask, terminateTask } from '@/actions/tasks';
import { ChatInput, useAgentModelSelector } from '@/components/features/tasks/input';
import { useInputToolsConfig } from '@/components/features/tasks/input/config-tools';
import { ChatMessages } from '@/components/features/tasks/messages';
import { ChatPreview } from '@/components/features/tasks/preview';
import { usePreviewData } from '@/components/features/tasks/preview/preview-content/workspace-preview';
import { aggregateMessages } from '@/lib/browser/chat-messages';
import { Message } from '@/lib/browser/chat-messages/types';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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

  const { selectedModel } = useAgentModelSelector();
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

  const eventSourceRef = useRef<EventSource | null>(null);

  const handleProgressUpdate = useCallback(
    (progress: any) => {
      setMessages(prev => {
        const newMessage = { ...progress, key: progress.id, index: progress.index || 0, type: progress.type as any, role: 'assistant' as const };
        const existingIndex = prev.findIndex(m => m.key === newMessage.key);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = newMessage;
          return updated;
        }
        return [...prev, newMessage];
      });

      if (shouldAutoScroll) {
        requestAnimationFrame(scrollToBottom);
        if (progress?.type === 'agent:lifecycle:step:think:browser:browse:complete') {
          setPreviewData({
            type: 'browser',
            url: progress.content.url,
            title: progress.content.title,
            screenshot: progress.content.screenshot,
          });
        }
        if (progress?.type === 'agent:lifecycle:step:act:tool:execute:start') {
          setPreviewData({ type: 'tool', executionId: progress.content.id });
        }
      }
    },
    [shouldAutoScroll, scrollToBottom, setPreviewData],
  );

  const initializeSSE = useCallback(() => {
    if (!taskId) return;

    const eventSource = new EventSource(`/api/tasks/stream?taskId=${taskId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'progress') {
          handleProgressUpdate(data.data);
        } else if (data.type === 'status') {
          const status = data.data.status;
          setIsThinking(status !== 'completed' && status !== 'failed' && status !== 'terminated');
          setIsTerminating(status === 'terminating');
        } else if (data.type === 'end') {
          const status = data.data.status;
          setIsThinking(false);
          setIsTerminating(status === 'terminating');
          eventSource.close();
        } else if (data.type === 'error') {
          console.error('SSE Error:', data.error);
          setIsThinking(false);
          eventSource.close();
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = error => {
      console.error('SSE connection error:', error);
      setIsThinking(false);
      eventSource.close();
    };

    return eventSource;
  }, [taskId, handleProgressUpdate]);

  const refreshTask = useCallback(async () => {
    const res = await getTask({ taskId });
    if (res.error || !res.data) {
      console.error('Error fetching task:', res.error);
      return;
    }
    setMessages(
      res.data.progresses.map(step => ({ ...step, key: step.id, index: step.index! || 0, type: step.type as any, role: 'assistant' as const })),
    );
    setIsThinking(res.data!.status !== 'completed' && res.data!.status !== 'failed' && res.data!.status !== 'terminated');
    setIsTerminating(res.data!.status === 'terminating');
  }, [taskId]);

  useEffect(() => {
    setPreviewData(null);
    if (!taskId) return;

    // Initialize with existing data
    refreshTask();

    // Start SSE connection for real-time updates
    const eventSource = initializeSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [taskId]);

  useEffect(() => {
    if (shouldAutoScroll) {
      requestAnimationFrame(scrollToBottom);
    }
  }, [messages, shouldAutoScroll, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (value: { prompt: string; files: File[]; shouldPlan: boolean }) => {
    try {
      // Close existing SSE connection before creating new task
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const res = await createTask({
        taskId,
        modelId: selectedModel?.id || '',
        prompt: value.prompt,
        toolIds: enabledTools,
        files: value.files,
      });
      if (res.error) {
        console.error('Error restarting task:', res.error);
        return;
      }

      setIsThinking(true);
      setMessages([]); // Clear existing messages

      // Start new SSE connection for the restarted task
      const eventSource = initializeSSE();
    } catch (error) {
      console.error('Error submitting task:', error);
    }
  };

  return (
    <div className="flex h-full w-full flex-row justify-between">
      <div className="flex h-full flex-1 flex-col">
        <div
          ref={messagesContainerRef}
          className="h-full space-y-4 overflow-y-auto p-4 pb-0"
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
        />
      </div>
      <div className="min-w-[400px] flex-1 overflow-hidden p-2">
        <ChatPreview taskId={taskId} messages={messages} />
      </div>
    </div>
  );
}
