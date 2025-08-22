'use client';

import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTask } from '@/actions/tasks';
import { useRecentTasks } from '@/components/features/chat-history-sidebar';
import { ChatInput } from '@/components/features/chat/input';
import { useInputToolsConfig } from '@/components/features/chat/input/config-tools';
import { useModelSelectorStore } from '@/components/features/model-selector';
import { useAgentSelectorStore } from '@/components/features/agent-selector';

const EmptyState = () => (
  <div className="flex h-full items-center justify-center gap-4 opacity-50">
    <Image src={logo} alt="HeyFun" width={64} height={64} />
    <div className="flex flex-col">
      <div className="text-2xl font-bold">HeyFun</div>
      <div className="text-muted-foreground text-sm">Hey! Let's bring a little fun to this world together.</div>
    </div>
  </div>
);

export default function ChatPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { refreshTasks } = useRecentTasks();

  const { selectedModel } = useModelSelectorStore('chat-input-model-storage');
  const { enabledTools } = useInputToolsConfig();
  const { selectedAgent } = useAgentSelectorStore('chat-input-agent-storage')();

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = async (value: { prompt: string; files: File[]; shouldPlan: boolean }) => {
    if (!value || isLoading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);

    try {
      const res = await createTask({
        taskId: undefined,
        agentId: selectedAgent?.id,
        modelProvider: selectedModel?.provider || '',
        modelId: selectedModel?.id || '',
        prompt: value.prompt,
        toolIds: enabledTools,
        files: value.files,
        shouldPlan: value.shouldPlan,
      });
      if (res.error || !res.data) {
        throw new Error('Failed to create task');
      }
      await refreshTasks();
      router.push(`/tasks/${res.data.id}`);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-20">
        <EmptyState />
      </div>
      <ChatInput status={isLoading ? 'thinking' : 'idle'} onSubmit={handleSubmit} />
    </div>
  );
}
