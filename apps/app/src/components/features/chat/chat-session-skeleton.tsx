/**
 * ChatSessionSkeleton 组件
 * 聊天会话的加载占位组件
 */

'use client';

import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * ChatSessionSkeleton 组件
 * 居中显示简单的加载图标
 */
export const ChatSessionSkeleton = () => {
  return (
    <div className="flex h-full flex-col">
      {/* Messages Area - 居中加载动画 */}
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>

      {/* Input Area */}
      <div className="border-border/50 border-t p-4">
        <div className="flex items-end gap-2 opacity-20">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="size-10 rounded-md" />
        </div>
      </div>
    </div>
  );
};
