'use client';

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { WorkspaceSidebar } from '@/components/features/workspace-sidebar';

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
        <WorkspaceSidebar />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={80} minSize={50}>
        <main className="h-full w-full flex-1 overflow-hidden">{children}</main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}