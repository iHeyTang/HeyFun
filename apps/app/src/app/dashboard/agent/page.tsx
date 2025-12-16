'use client';

import { ChatContainer } from '@/components/features/chat/chat-container';

export default function AgentPage() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-1 overflow-hidden">
        <ChatContainer apiPrefix="/api/agent" layout="sidebar" sidebarWidth="280px" />
      </div>
    </div>
  );
}
