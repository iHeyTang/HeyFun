'use client';

import { cn } from '@/lib/utils';
import { ChatSessions } from '@prisma/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { create } from 'zustand';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getChatSessions } from '@/actions/chat';

export const useRecentChatSessions = create<{
  sessions: ChatSessions[];
  refreshSessions: () => Promise<void>;
    }>(set => ({
      sessions: [],
      refreshSessions: async () => {
        const res = await getChatSessions({ page: 1, pageSize: 30 });
        set({ sessions: res.data?.sessions || [] });
      },
    }));

export function ChatHistorySidebar() {
  const { sessions, refreshSessions } = useRecentChatSessions();
  const pathname = usePathname();

  const currentSessionId = pathname.split('/').pop();

  useEffect(() => {
    refreshSessions();
  }, []);

  return (
    <div className="bg-muted/20 flex h-full flex-col gap-2 pt-2">
      <div className="flex items-center justify-between px-2">
        <div className="text-muted-foreground text-xs font-medium whitespace-nowrap">Chat History</div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
          <Link href="/chat">
            <Plus className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto pb-4">
        {sessions.length === 0 ? (
          <div className="text-muted-foreground px-2 py-4 text-center text-xs">No chat history yet</div>
        ) : (
          sessions.map(session => (
            <Link
              href={`/chat/${session.id}`}
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
