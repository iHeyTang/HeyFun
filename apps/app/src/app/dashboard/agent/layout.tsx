'use client';

import { SessionSidebar } from '@/components/features/chat/session-sidebar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useChatSessionsStore } from '@/hooks/use-chat-sessions';
import { useEffect, useRef } from 'react';
import { useParams, usePathname } from 'next/navigation';

function AgentLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ sessionId?: string }>();
  const { setActiveSessionId, loadSessions } = useChatSessionsStore();

  // 从路由中获取 sessionId
  const routeSessionId = params?.sessionId || null;
  const isInitialMountRef = useRef(true);

  // 初始化加载 sessions（只在首次加载时执行）
  useEffect(() => {
    if (isInitialMountRef.current) {
      loadSessions({
        initialSessionId: routeSessionId || undefined,
        externalSessionId: routeSessionId || undefined,
      });
      isInitialMountRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当路由中的 sessionId 变化时，同步更新 activeSessionId
  useEffect(() => {
    if (routeSessionId) {
      setActiveSessionId(routeSessionId);
    } else {
      // 如果路由中没有 sessionId，清空 activeSessionId
      setActiveSessionId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSessionId, pathname]);

  return (
    <ResizablePanelGroup direction="horizontal" className="flex h-full w-full">
      {/* Session Sidebar */}
      <ResizablePanel defaultSize={17} minSize={10} maxSize={40} className="min-w-[240px]">
        <SessionSidebar />
      </ResizablePanel>
      <ResizableHandle />

      {/* Main Content */}
      <ResizablePanel defaultSize={83} minSize={60} className="flex flex-1 flex-col overflow-hidden">
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return <AgentLayoutInner>{children}</AgentLayoutInner>;
}
