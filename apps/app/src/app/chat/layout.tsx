'use client';

import { ChatHistorySidebar } from '@/components/features/chat/chat-history-sidebar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useLLM } from '@/hooks/use-llm';
import { useEffect } from 'react';

export default function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { initiate } = useLLM();

  useEffect(() => {
    initiate();
  }, [initiate]);

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize={18} minSize={10}>
        <ChatHistorySidebar />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={82} minSize={50}>
        <main className="h-full w-full flex-1 overflow-hidden">{children}</main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
