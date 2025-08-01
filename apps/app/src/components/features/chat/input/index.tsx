import { confirm } from '@/components/block/confirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useModelProvider } from '@/hooks/use-llm';
import { Check, Circle, Paperclip, PauseCircle, Rocket, Send, Share2, Wrench, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { InputToolsConfigDialog, InputToolsConfigDialogRef, useInputToolsConfig } from './config-tools';
import InputModelConfigDialog, { ModelSelectorRef, useInputModelConfig } from './config-model';
import { ShareDialog, ShareDialogRef } from './share-dialog';

interface ChatInputProps {
  status?: 'idle' | 'thinking' | 'terminating' | 'completed';
  onSubmit?: (value: { prompt: string; files: File[]; shouldPlan: boolean }) => Promise<void>;
  onTerminate?: () => Promise<void>;
  taskId?: string;
}

export const ChatInput = ({ status = 'idle', onSubmit, onTerminate, taskId }: ChatInputProps) => {
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolsConfigDialogRef = useRef<InputToolsConfigDialogRef>(null);
  const modelSelectorRef = useRef<ModelSelectorRef>(null);
  const shareDialogRef = useRef<ShareDialogRef>(null);
  const [value, setValue] = useState('');
  const [shouldPlan, setShouldPlan] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const { enabledTools } = useInputToolsConfig();

  const { selectedModel } = useInputModelConfig();
  const { availableModels, refreshAvailableModels } = useModelProvider();

  useEffect(() => {
    refreshAvailableModels();
  }, [refreshAvailableModels]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSendClick = async () => {
    if (status === 'thinking' || status === 'terminating') {
      confirm({
        content: (
          <DialogHeader>
            <DialogTitle>Terminate Task</DialogTitle>
            <DialogDescription>Are you sure you want to terminate this task?</DialogDescription>
          </DialogHeader>
        ),
        onConfirm: async () => {
          await onTerminate?.();
          router.refresh();
        },
        buttonText: {
          cancel: 'Cancel',
          confirm: 'Terminate',
          loading: 'Terminating...',
        },
      });
      return;
    }
    const v = value.trim();
    if (v || files.length > 0) {
      await onSubmit?.({ prompt: v, files, shouldPlan });
      setValue('');
      setFiles([]);
    }
  };

  const handleEnterKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      await handleSendClick();
    }
  };

  const handleShareClick = () => {
    if (!taskId) return;
    shareDialogRef.current?.open(taskId);
  };

  return (
    <div className="pointer-events-none p-4">
      <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-2">
        {status !== 'idle' && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              className="flex cursor-pointer items-center gap-2 rounded-full"
              type="button"
              onClick={() => router.push('/tasks')}
            >
              <Rocket className="h-4 w-4" />
              <span>New Task</span>
            </Button>
            {taskId && status === 'completed' && (
              <Button variant="outline" className="flex cursor-pointer items-center gap-2 rounded-full" type="button" onClick={handleShareClick}>
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </Button>
            )}
          </div>
        )}
        <div className="bg-background dark:bg-background flex w-full flex-col rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] dark:border">
          <Textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleEnterKeyDown}
            disabled={status === 'thinking' || status === 'terminating'}
            placeholder={
              status === 'thinking'
                ? 'Thinking...'
                : status === 'terminating'
                  ? 'Terminating...'
                  : status === 'completed'
                    ? 'Task completed!'
                    : "Let's Imagine the Impossible, Create the Future Together"
            }
            className="min-h-[80px] flex-1 resize-none border-none bg-transparent px-4 py-3 shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
          />
          <div className="border-border/50 flex items-center justify-between border-t px-4 py-2">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger>
                  <Badge
                    variant={shouldPlan ? 'default' : 'secondary'}
                    className="flex cursor-pointer items-center gap-1"
                    onClick={() => setShouldPlan(!shouldPlan)}
                  >
                    {shouldPlan ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                    <span>Plan</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Agent will plan the task before executing</p>
                </TooltipContent>
              </Tooltip>
              <Badge variant="secondary" className="flex cursor-pointer items-center gap-1" onClick={() => modelSelectorRef.current?.open()}>
                <Wrench className="h-3 w-3" />
                <span>{selectedModel?.name || 'Unknown Model'}</span>
              </Badge>
              <Badge variant="secondary" className="flex cursor-pointer items-center gap-1" onClick={() => toolsConfigDialogRef.current?.open()}>
                <Wrench className="h-3 w-3" />
                <span>Tools {enabledTools.length ? `(${enabledTools.length})` : ''}</span>
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {files.length > 0 && (
                <Badge variant="secondary" className="flex cursor-default items-center gap-1 py-1 pr-1 pl-2">
                  <span>
                    {files.length} File{files.length > 1 ? 's' : ''}
                  </span>
                  <Badge
                    variant="secondary"
                    className="hover:bg-muted-foreground/20 ml-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full p-0"
                    onClick={() => setFiles([])}
                    aria-label="Clear selected files"
                  >
                    <X className="text-muted-foreground h-3 w-3" />
                  </Badge>
                </Badge>
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 cursor-pointer rounded-xl"
                onClick={triggerFileSelect}
                aria-label="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input type="file" ref={fileInputRef} multiple onChange={handleFileSelect} className="hidden" accept="*" />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 cursor-pointer rounded-xl"
                onClick={handleSendClick}
                disabled={status !== 'idle' && status !== 'completed' && !(status === 'thinking' || status === 'terminating')}
                aria-label={status === 'thinking' || status === 'terminating' ? 'Terminate task' : 'Send message'}
              >
                {status === 'thinking' || status === 'terminating' ? <PauseCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <InputToolsConfigDialog ref={toolsConfigDialogRef} />
      <InputModelConfigDialog ref={modelSelectorRef} availableModels={availableModels} />
      <ShareDialog ref={shareDialogRef} />
    </div>
  );
};
