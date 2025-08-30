'use client';

import { UnifiedGenerationForm } from '@/components/features/paintboard/generation-form';
import { PaintboardTaskHistory, type TaskHistoryRef } from '@/components/features/paintboard/task-history';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useRef } from 'react';

export default function GeneralGenerationPage() {
  const taskHistoryRef = useRef<TaskHistoryRef>(null);

  const handleFormSubmit = async (data: unknown) => {
    console.log('Generation task submitted:', data);
    // 提交成功后立即刷新任务列表
    if (taskHistoryRef.current) {
      await taskHistoryRef.current.triggerRefresh();
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize={18} minSize={10}>
        <UnifiedGenerationForm onSubmit={handleFormSubmit} />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={82} minSize={50}>
        <PaintboardTaskHistory ref={taskHistoryRef} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
