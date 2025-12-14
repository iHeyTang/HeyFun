/**
 * ChatContainerSkeleton 组件
 * 聊天容器的加载占位组件
 */

'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { ChatSessionSkeleton } from './chat-session-skeleton';

type ChatContainerLayout = 'tabs' | 'sidebar';

interface ChatContainerSkeletonProps {
  /** 布局类型 */
  layout?: ChatContainerLayout;
  /** 侧边栏宽度（仅当 layout='sidebar' 时生效） */
  sidebarWidth?: string;
}

/**
 * ChatContainerSkeleton 组件
 * 根据布局类型显示不同的 skeleton 占位
 */
export const ChatContainerSkeleton = ({ layout = 'tabs', sidebarWidth = '280px' }: ChatContainerSkeletonProps) => {
  // Tabs 布局的 Skeleton
  if (layout === 'tabs') {
    return (
      <div className="flex h-full flex-col">
        {/* Session Tabs Skeleton */}
        <div className="flex items-center gap-2 px-1 py-1">
          <div className="flex flex-1 gap-1">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-0.5">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="size-7 rounded-md" />
          </div>
        </div>

        {/* Chat Content Skeleton */}
        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
          <div className="flex gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="ml-auto h-4 w-2/3 rounded-md" />
              <Skeleton className="ml-auto h-4 w-1/3 rounded-md" />
            </div>
            <Skeleton className="size-8 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-4/5 rounded-md" />
              <Skeleton className="h-4 w-3/5 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Sidebar 布局的 Skeleton
  return (
    <div className="flex h-full">
      {/* Session Sidebar Skeleton */}
      <div className="border-border/50 bg-background/50 flex h-full flex-col border-r" style={{ width: sidebarWidth }}>
        {/* Header Skeleton */}
        <div className="border-border/50 flex items-center justify-between border-b px-3 py-2">
          <Skeleton className="h-4 w-12 rounded-md" />
          <div className="flex items-center gap-0.5">
            <Skeleton className="size-7 rounded-md" />
          </div>
        </div>

        {/* Sessions List Skeleton */}
        <div className="flex-1 space-y-1.5 p-1.5">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-4/5 rounded-md" />
        </div>
      </div>

      {/* Chat Content Skeleton */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
        <ChatSessionSkeleton />
      </div>
    </div>
  );
};
