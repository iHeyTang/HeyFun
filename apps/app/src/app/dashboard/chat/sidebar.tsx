'use client';

import { useRecentChatSessions } from '@/components/features/chat/chat-container';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MessageSquare, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function ChatHistorySidebar() {
  const { sessions, refreshSessions, loading } = useRecentChatSessions();
  const pathname = usePathname();

  const currentSessionId = pathname.split('/').pop();

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  return (
    <div className="bg-muted/20 flex h-full flex-col gap-2 pt-2">
      <div className="flex items-center justify-between px-2">
        <div className="text-muted-foreground text-xs font-medium whitespace-nowrap">Chat History</div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
          <Link href="/dashboard/chat">
            <Plus className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto pb-4">
        {loading ? (
          <div className="flex flex-col gap-1 px-2">
            {Array.from({ length: 8 }).map((_, index) => {
              const widths = ['w-3/4', 'w-full', 'w-5/6', 'w-2/3', 'w-4/5', 'w-full', 'w-3/5', 'w-5/6'];
              const heights = ['h-4', 'h-4', 'h-5', 'h-4', 'h-4', 'h-5', 'h-4', 'h-4'];
              return (
                <div key={index} className="flex items-center gap-2 p-2">
                  <Skeleton className="h-3 w-3 flex-shrink-0 rounded-sm" />
                  <Skeleton className={`${heights[index]} ${widths[index]}`} />
                </div>
              );
            })}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-muted-foreground px-2 py-4 text-center text-xs">No chat history yet</div>
        ) : (
          sessions.map(session => (
            <Link
              href={`/dashboard/chat/${session.id}`}
              key={session.id}
              className={cn(
                'hover:bg-muted flex cursor-pointer items-center gap-2 p-2 pl-2.5 text-sm',
                currentSessionId === session.id && 'bg-muted',
              )}
            >
              <MessageSquare className="h-3 w-3 flex-shrink-0" />
              <div className="truncate">{session.title || 'New Chat'}</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
