'use client';

import { pageTasks } from '@/actions/tasks';
import { ShareDialog, ShareDialogRef } from '@/components/features/tasks/input/share-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tasks } from '@prisma/client';
import { Plus, Share2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

export const useRecentTasks = create<{ tasks: Tasks[]; refreshTasks: () => Promise<void> }>(set => ({
  tasks: [],
  refreshTasks: async () => {
    const res = await pageTasks({ page: 1, pageSize: 30 });
    set({ tasks: res.data?.tasks || [] });
  },
}));

export function TaskHistorySidebar() {
  const { tasks, refreshTasks } = useRecentTasks();
  const pathname = usePathname();
  const router = useRouter();
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const shareDialogRef = useRef<ShareDialogRef>(null);
  const currentTaskId = pathname.split('/').pop();

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  const handleShare = async (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    shareDialogRef.current?.open(taskId);
  };

  const handleNewTask = () => {
    router.push('/tasks');
  };

  return (
    <div className="bg-muted/20 flex h-full flex-col gap-2 pt-2">
      <div className="flex items-center justify-between px-2">
        <div className="text-muted-foreground text-xs font-medium whitespace-nowrap">Recent Tasks</div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleNewTask}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto pb-4">
        {tasks.map(item => (
          <div key={item.id} className="group relative" onMouseEnter={() => setHoveredTaskId(item.id)} onMouseLeave={() => setHoveredTaskId(null)}>
            <Link
              href={`/tasks/${item.id}`}
              className={cn('hover:bg-muted block cursor-pointer p-2 pr-8 pl-2.5 text-sm', currentTaskId === item.id && 'bg-muted')}
            >
              <div className="truncate">{item.summary || item.prompt}</div>
            </Link>
            {hoveredTaskId === item.id && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={e => handleShare(e, item.id)}
              >
                <Share2 className="text-muted-foreground h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <ShareDialog ref={shareDialogRef} />
    </div>
  );
}
