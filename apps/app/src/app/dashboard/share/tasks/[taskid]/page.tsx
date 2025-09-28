'use client';

import { getSharedTask } from '@/actions/tasks';
import { ChatMessages } from '@/components/features/tasks/messages';
import { ChatPreview } from '@/components/features/tasks/preview';
import { usePreviewData } from '@/components/features/tasks/preview/preview-content/workspace-preview';
import { aggregateMessages } from '@/lib/browser/chat-messages';
import { Message } from '@/lib/browser/chat-messages/types';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export default function ChatSharePage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.taskid as string;

  const { setData: setPreviewData } = usePreviewData();
  const [isNearBottom, setIsNearBottom] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesQueueRef = useRef<Message[]>([]);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  const shouldAutoScroll = true || isNearBottom;

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

  const processMessageQueue = () => {
    if (messagesQueueRef.current.length > 0) {
      const nextMessage = messagesQueueRef.current.shift();

      setMessages(prevMessages => [...prevMessages, nextMessage!]);
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

      if (messagesQueueRef.current.length > 0) {
        timeoutIdRef.current = setTimeout(processMessageQueue, 200);
      }
    }
  };

  const refreshTask = useCallback(async () => {
    const res = await getSharedTask({ taskId });
    if (res.error || !res.data) {
      console.error('Error fetching task:', res.error);
      return;
    }

    setMessages([]);
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    messagesQueueRef.current = res.data.progresses.map(step => ({
      ...step,
      key: step.id,
      index: step.index! || 0,
      type: step.type as any,
      role: 'assistant' as const,
    }));

    if (messagesQueueRef.current.length > 0) {
      timeoutIdRef.current = setTimeout(processMessageQueue, 500);
    }

    if (shouldAutoScroll) {
      requestAnimationFrame(scrollToBottom);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    refreshTask();

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [taskId, refreshTask]);

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
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [abortControllerRef, timeoutIdRef]);

  return (
    <div className="flex h-full w-full flex-row justify-between">
      <div className="flex-1">
        <div className="relative flex h-full flex-col">
          <div
            ref={messagesContainerRef}
            className="flex-3/5 space-y-4 overflow-y-auto p-4 pb-60"
            style={{
              scrollBehavior: 'smooth',
              overscrollBehavior: 'contain',
            }}
            onScroll={handleScroll}
          >
            <ChatMessages messages={aggregateMessages(messages)} />
          </div>
          <div className="fixed bottom-4 left-4 z-50">
            <Button onClick={() => router.push('/')} className="flex items-center gap-2 bg-button-primary text-primary shadow-lg hover:bg-button-primary-hover">
              <Sparkles className="h-4 w-4" />
              Try it now!
            </Button>
          </div>
        </div>
      </div>
      <div className="min-w-[800px] flex-1 items-center justify-center p-2">
        <ChatPreview taskId={taskId} messages={messages} />
      </div>
    </div>
  );
}
