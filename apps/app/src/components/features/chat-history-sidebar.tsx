'use client';

import { getMe } from '@/actions/me';
import { pageTasks } from '@/actions/tasks';
import { cn } from '@/lib/utils';
import { Tasks } from '@prisma/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { create } from 'zustand';

export const useRecentTasks = create<{ tasks: Tasks[]; refreshTasks: () => Promise<void> }>(set => ({
  tasks: [],
  refreshTasks: async () => {
    const res = await pageTasks({ page: 1, pageSize: 30 });
    set({ tasks: res.data?.tasks || [] });
  },
}));

const useMeStore = create<{ me: Awaited<ReturnType<typeof getMe>>['data'] | null; refreshMe: () => Promise<void> }>(set => ({
  me: null,
  refreshMe: async () => {
    const res = await getMe({});
    if (res.error || !res.data) {
      throw new Error('Failed to fetch user data');
    }
    set({ me: res.data });
  },
}));

export function TaskHistorySidebar() {
  const { tasks, refreshTasks } = useRecentTasks();
  const pathname = usePathname();

  const currentTaskId = pathname.split('/').pop();

  useEffect(() => {
    refreshTasks();
  }, []);

  return (
    <div className="bg-muted/20 flex h-full flex-col gap-2 pt-2">
      <div className="text-muted-foreground px-2 text-xs font-medium whitespace-nowrap">Recent Tasks</div>
      <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto pb-4">
        {tasks.map(item => (
          <Link
            href={`/tasks/${item.id}`}
            key={item.id}
            className={cn('hover:bg-muted cursor-pointer p-2 pl-2.5 text-sm', currentTaskId === item.id && 'bg-muted')}
          >
            <div className="truncate">{item.summary || item.prompt}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
