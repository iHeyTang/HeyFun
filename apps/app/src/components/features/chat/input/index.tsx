import { confirm } from '@/components/block/confirm';
import { ChatInput as BaseChatInput } from '@/components/features/chat-input';
import { ModelInfo, ModelSelectorDialog, ModelSelectorRef, useModelSelectorStore } from '@/components/features/model-selector';
import { AgentInfo, AgentSelectorDialog, AgentSelectorRef, useAgentSelectorStore } from '@/components/features/agent-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useModelProvider } from '@/hooks/use-llm';
import { getAgents } from '@/actions/agents';
import { Check, Circle, Paperclip, PauseCircle, Rocket, Send, Share2, Wrench, X, Bot } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { InputToolsConfigDialog, InputToolsConfigDialogRef, useInputToolsConfig } from './config-tools';
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
  const agentSelectorRef = useRef<AgentSelectorRef>(null);
  const shareDialogRef = useRef<ShareDialogRef>(null);
  const [shouldPlan, setShouldPlan] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [availableAgents, setAvailableAgents] = useState<AgentInfo[]>([]);
  const { enabledTools } = useInputToolsConfig();

  const { selectedModel, setSelectedModel } = useModelSelectorStore('chat-input-model-storage');
  const { selectedAgent, setSelectedAgent } = useAgentSelectorStore('chat-input-agent-storage')();
  const { availableModels, refreshAvailableModels } = useModelProvider();

  useEffect(() => {
    refreshAvailableModels();
    // Load available agents
    const loadAgents = async () => {
      try {
        const result = await getAgents({});
        if (result.data) {
          setAvailableAgents(result.data);
        }
      } catch (error) {
        console.error('Failed to load agents:', error);
      }
    };
    loadAgents();
  }, [refreshAvailableModels]);

  const handleModelSelect = (model: ModelInfo) => {
    setSelectedModel(model);
  };

  const handleAgentSelect = (agent: AgentInfo | null) => {
    setSelectedAgent(agent);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSendClick = async (message: string) => {
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

    const v = message.trim();
    if (v || files.length > 0) {
      await onSubmit?.({ prompt: v, files, shouldPlan });
      setFiles([]);
    }
  };

  const handleShareClick = () => {
    if (!taskId) return;
    shareDialogRef.current?.open(taskId);
  };

  const getPlaceholder = () => {
    switch (status) {
      case 'thinking':
        return 'Thinking...';
      case 'terminating':
        return 'Terminating...';
      case 'completed':
        return 'Task completed!';
      default:
        return "Let's Imagine the Impossible, Create the Future Together";
    }
  };

  const renderHeader = () => {
    if (status === 'idle') return null;

    return (
      <div className="flex justify-center gap-2">
        <Button variant="outline" className="flex cursor-pointer items-center gap-2 rounded-full" type="button" onClick={() => router.push('/tasks')}>
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
    );
  };

  const renderFooter = ({ message }: { message: string; handleSend: () => void | Promise<void>; disabled: boolean }) => (
    <div className="flex items-center justify-between px-4 py-2">
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
          <span>{selectedModel?.name || 'Select Model'}</span>
        </Badge>
        <Badge variant="secondary" className="flex cursor-pointer items-center gap-1" onClick={() => agentSelectorRef.current?.open()}>
          <Bot className="h-3 w-3" />
          <span>{selectedAgent?.name || 'FunMax'}</span>
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
          onClick={() => handleSendClick(message)}
          disabled={status !== 'idle' && status !== 'completed' && !(status === 'thinking' || status === 'terminating')}
          aria-label={status === 'thinking' || status === 'terminating' ? 'Terminate task' : 'Send message'}
        >
          {status === 'thinking' || status === 'terminating' ? <PauseCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <BaseChatInput
        onSend={handleSendClick}
        disabled={status === 'thinking' || status === 'terminating'}
        placeholder={getPlaceholder()}
        renderHeader={renderHeader}
        renderFooter={renderFooter}
      />
      <InputToolsConfigDialog ref={toolsConfigDialogRef} />
      <ModelSelectorDialog
        ref={modelSelectorRef}
        availableModels={availableModels}
        selectedModel={selectedModel}
        onModelSelect={handleModelSelect}
        storageKey="chat-input-model-storage"
      />
      <AgentSelectorDialog
        ref={agentSelectorRef}
        availableAgents={availableAgents}
        selectedAgent={selectedAgent}
        onAgentSelect={handleAgentSelect}
        storageKey="chat-input-agent-storage"
      />
      <ShareDialog ref={shareDialogRef} />
    </>
  );
};
