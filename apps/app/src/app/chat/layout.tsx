'use client';

import { ChatHistorySidebar } from '@/components/features/simple-chat/chat-history-sidebar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useModelProvider } from '@/hooks/use-llm';
import { useEffect } from 'react';

export default function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { refreshAvailableModels } = useModelProvider();

  useEffect(() => {
    refreshAvailableModels();
  }, [refreshAvailableModels]);

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
