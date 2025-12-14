'use client';

import { ChatContainer } from '@/components/features/chat/chat-container';
import { createAgentSessionManager } from '@/lib/browser/session-manager';
import { useMemo } from 'react';

export default function AgentPage() {
  // 创建 Agent Session 管理器，默认使用 'general' agent
  const sessionManager = useMemo(() => createAgentSessionManager('general'), []);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-1 overflow-hidden">
        <ChatContainer
          sessionManager={sessionManager}
          apiPrefix="/api/chat"
          layout="sidebar"
          sidebarWidth="280px"
        />
      </div>
    </div>
  );
}

