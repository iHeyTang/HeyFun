import { Message } from '@/lib/browser/chat-messages/types';
import { BrowserPreview } from './browser-preview';
import { ToolPreview } from './tool-preview';
import { usePreviewData, WorkspacePreview } from './workspace-preview';

export const PreviewContent = ({ messages, className }: { messages: Message[]; className?: string }) => {
  const { data } = usePreviewData();

  if (data?.type === 'tool') {
    return <ToolPreview messages={messages} executionId={data.executionId} className={className} />;
  }

  if (data?.type === 'browser') {
    return <BrowserPreview url={data.url} title={data.title} screenshot={data.screenshot} />;
  }

  if (data?.type === 'workspace') {
    return <WorkspacePreview />;
  }

  return <NotPreview />;
};

const NotPreview = () => {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-pulse text-gray-500">FunMax is not using the computer right now...</div>
    </div>
  );
};
