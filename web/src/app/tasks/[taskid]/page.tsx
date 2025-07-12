'use client';

import { ChatInput } from '@/components/features/chat/input';
import { ChatMessages } from '@/components/features/chat/messages';
import { ChatPreview } from '@/components/features/chat/preview';
import { usePreviewData } from '@/components/features/chat/preview/store';
import { aggregateMessages } from '@/lib/chat-messages';
import { Message } from '@/lib/chat-messages/types';
import {
  createTaskApiTasksPost,
  taskEventsApiTasksTaskIdEventsGet,
  getTaskApiTasksTaskIdGet,
  terminateTaskApiTasksTaskIdTerminatePost,
} from '@/server';
import { uniqBy } from 'lodash';
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
  const eventSourceRef = useRef<EventSource | null>(null);

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

  const connectToEventStream = () => {
    if (!taskId) return;

    // 关闭之前的连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // 创建新的EventSource连接
    const eventSource = new EventSource(`http://localhost:5172/api/tasks/${taskId}/events`, { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);

        // 转换事件数据为Message格式
        const message: Message = {
          index: data.index || 0,
          type: data.name as any,
          role: 'assistant' as const,
          createdAt: new Date(),
          step: data.step,
          content: data.content,
        };

        setMessages(prevMessages => {
          const newMessages = uniqBy([...prevMessages, message], 'index');

          // 处理预览数据
          if (shouldAutoScroll) {
            if (message.type === 'agent:lifecycle:step:think:browser:browse:complete') {
              setPreviewData({
                type: 'browser',
                url: message.content.url,
                title: message.content.title,
                screenshot: message.content.screenshot,
              });
            }
            if (message.type === 'agent:lifecycle:step:act:tool:execute:start') {
              setPreviewData({ type: 'tool', toolId: message.content.id });
            }
          }

          return newMessages;
        });

        // 更新任务状态
        if (data.name === 'agent:lifecycle:complete') {
          setIsThinking(false);
          // 任务完成，主动关闭连接
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        } else if (data.name === 'agent:lifecycle:terminating') {
          setIsTerminating(true);
        } else if (data.name === 'agent:lifecycle:terminated') {
          setIsThinking(false);
          setIsTerminating(false);
          // 任务终止，主动关闭连接
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        } else if (data.name === 'agent:lifecycle:start') {
          setIsThinking(true);
          setIsTerminating(false);
        }
      } catch (error) {
        console.error('Error parsing SSE event:', error);
      }
    };

    // 监听特定的事件类型
    eventSource.addEventListener('complete', () => {
      console.log('Task completed, closing connection');
      setIsThinking(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    });

    eventSource.addEventListener('terminated', () => {
      console.log('Task terminated, closing connection');
      setIsThinking(false);
      setIsTerminating(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    });

    eventSource.addEventListener('error', event => {
      console.log('Server sent error event:', event);
      // 服务器发送了错误事件，关闭连接
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    });

    eventSource.onerror = error => {
      console.error('EventSource error:', error);
      // 只有在任务还在进行中时才重新连接
      if (isThinking && !isTerminating) {
        setTimeout(() => {
          connectToEventStream();
        }, 5000);
      } else {
        // 任务已完成或终止，关闭连接
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      }
    };

    eventSource.onopen = () => {
      console.log('EventSource connected');
    };
  };

  const getInitialTaskStatus = async () => {
    if (!taskId) return;

    try {
      const res = await getTaskApiTasksTaskIdGet({ path: { task_id: taskId } });
      if (res.error || !res.data) {
        console.error('Error fetching task:', res.error);
        return;
      }

      // 设置初始状态
      setIsThinking(res.data.status !== 'completed' && res.data.status !== 'failed' && res.data.status !== 'terminated');
      setIsTerminating(res.data.status === 'terminating');

      connectToEventStream();
    } catch (error) {
      console.error('Error getting initial task status:', error);
    }
  };

  useEffect(() => {
    setPreviewData(null);
    if (!taskId) return;

    getInitialTaskStatus();
  }, [taskId]);

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
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleSubmit = async (value: { modelId: string; prompt: string; tools: string[]; files: File[]; shouldPlan: boolean }) => {
    try {
      const res = await createTaskApiTasksPost({
        body: {
          task_id: taskId,
          llm_config: { modelId: value.modelId },
          prompt: value.prompt,
          tools: value.tools,
          files: value.files,
        },
      });
      if (res.error) {
        console.error('Error restarting task:', res.error);
      }
      setIsThinking(true);
      setMessages([]); // 清空之前的消息
      connectToEventStream(); // 重新连接事件流
      router.refresh();
    } catch (error) {
      console.error('Error submitting task:', error);
    }
  };

  return (
    <div className="flex h-screen w-full flex-row justify-between">
      <div className="flex-1">
        <div className="relative flex h-screen flex-col">
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
          <ChatInput
            status={isThinking ? 'thinking' : isTerminating ? 'terminating' : 'completed'}
            onSubmit={handleSubmit}
            onTerminate={async () => {
              await terminateTaskApiTasksTaskIdTerminatePost({ path: { task_id: taskId } });
              router.refresh();
            }}
            taskId={taskId}
          />
        </div>
      </div>
      <div className="min-w-[400px] flex-1 items-center justify-center p-2">
        <ChatPreview taskId={taskId} messages={messages} />
      </div>
    </div>
  );
}
