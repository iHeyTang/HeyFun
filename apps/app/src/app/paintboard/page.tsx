'use client';

import { UnifiedGenerationForm } from '@/components/features/paintboard/generation-form';
import { PaintboardTaskHistory } from '@/components/features/paintboard/task-history';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

export default function GeneralGenerationPage() {
  const handleFormSubmit = (data: unknown) => {
    console.log('Generation task submitted:', data);
    // 这里可以添加更多的处理逻辑，比如更新历史记录
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize={18} minSize={10}>
        <UnifiedGenerationForm onSubmit={handleFormSubmit} />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={82} minSize={50}>
        <PaintboardTaskHistory />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
