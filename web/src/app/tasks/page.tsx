'use client';

import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTask } from '@/actions/tasks';
import { useRecentTasks } from '@/components/features/app-sidebar';
import { ChatInput } from '@/components/features/chat/input';

const EmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center opacity-50">
    <Image src={logo} alt="HeyFun" className="mb-4 object-contain" width={120} height={120} />
    <div>Hey! Let's bring a little fun to this world together.</div>
  </div>
);

export default function ChatPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { refreshTasks } = useRecentTasks();

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = async (input: { modelId: string; prompt: string; tools: string[]; files: File[]; shouldPlan: boolean }) => {
    if (!input || isLoading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);

    try {
      const res = await createTask({
        taskId: undefined,
        modelId: input.modelId,
        prompt: input.prompt,
        tools: input.tools,
        files: input.files,
        shouldPlan: input.shouldPlan,
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
    <div className="flex h-screen flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-20">
        <EmptyState />
      </div>
      <ChatInput onSubmit={handleSubmit} status={isLoading ? 'thinking' : 'idle'} />
    </div>
  );
}
