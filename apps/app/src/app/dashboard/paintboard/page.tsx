'use client';

import { PaintBoardForm } from '@/app/dashboard/paintboard/paintboard-form';
import { PaintboardTaskHistory, type TaskHistoryRef } from '@/app/dashboard/paintboard/task-history';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useRef } from 'react';

export default function GeneralGenerationPage() {
  const taskHistoryRef = useRef<TaskHistoryRef>(null);

  const handleFormSubmitSuccess = async (newTask?: any) => {
    // 提交成功后立即刷新任务列表
    if (taskHistoryRef.current) {
      if (newTask) {
        // 如果有新任务信息，直接添加到列表顶部
        await taskHistoryRef.current.addNewTask(newTask);
      } else {
        // 否则使用原来的刷新方式
        await taskHistoryRef.current.triggerRefresh();
      }
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize={24} minSize={10}>
        <PaintBoardForm onSubmitSuccess={handleFormSubmitSuccess} />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={76} minSize={50}>
        <PaintboardTaskHistory ref={taskHistoryRef} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
