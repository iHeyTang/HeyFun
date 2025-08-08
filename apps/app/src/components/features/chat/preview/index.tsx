import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { Message } from '@/lib/browser/chat-messages/types';
import { FolderIcon } from 'lucide-react';
import { PreviewContent } from './preview-content';
import { usePreviewData } from './store';

interface ChatPreviewProps {
  messages: Message[];
  taskId: string;
}

export const ChatPreview = ({ messages, taskId }: ChatPreviewProps) => {
  const { setData } = usePreviewData();
  return (
    <div className="flex h-full flex-col gap-2 rounded-2xl border p-2">
      <div>
        <div className="flex items-center justify-between">
          <CardTitle className="text-normal">FunMax's Computer</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="hover:bg-accent/80 bg-silver-gradient flex items-center gap-1.5"
            onClick={() => setData({ type: 'workspace', path: '' })}
          >
            <FolderIcon className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Task Workspace</span>
          </Button>
        </div>
      </div>
      <div className="h-full flex-1 overflow-hidden">
        <PreviewContent messages={messages} className="h-full" />
      </div>
    </div>
  );
};
