import { getAgents } from '@/actions/agents';
import { ChatInput as BaseChatInput } from '@/components/block/chat-input';
import { confirm } from '@/components/block/confirm';
import { AgentInfo, AgentSelectorDialog, AgentSelectorRef, useAgentSelectorStore } from '@/components/features/agent-selector';
import { ModelInfo, ModelSelectorDialog, ModelSelectorRef } from '@/components/features/model-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Bot, Check, Circle, Paperclip, PauseCircle, Send, Wrench, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { InputToolsConfigDialog, InputToolsConfigDialogRef, useInputToolsConfig } from './config-tools';
import { create } from 'zustand';
import { usePreferences } from '@/hooks/use-preferences';
import { useLLM } from '@/hooks/use-llm';
import { useTranslations } from 'next-intl';

interface ChatInputProps {
  status?: 'idle' | 'thinking' | 'terminating' | 'completed';
  onSubmit?: (value: { prompt: string; files: File[]; shouldPlan: boolean }) => Promise<void>;
  onTerminate?: () => Promise<void>;
}

const useAgentModelSelectorStore = create<{
  selectedModel: ModelInfo | null;
  setSelectedModel: (model: ModelInfo | null) => void;
}>()(set => ({
  selectedModel: null,
  setSelectedModel: model => {
    set({ selectedModel: model });
  },
}));

export const useAgentModelSelector = () => {
  const { availableModels } = useLLM();
  const { data: preferences, update: updatePreferences } = usePreferences();
  const { selectedModel, setSelectedModel } = useAgentModelSelectorStore();

  useEffect(() => {
    if (preferences?.defaultAgentModel && !selectedModel) {
      setSelectedModel(
        availableModels.find(m => m.id === preferences.defaultAgentModel?.id && m.provider === preferences.defaultAgentModel?.provider) || null,
      );
    }
  }, [availableModels, preferences?.defaultAgentModel, selectedModel, setSelectedModel]);

  const handleModelSelect = async (model: ModelInfo) => {
    await updatePreferences({ defaultAgentModel: model });
    setSelectedModel(model);
  };

  return { selectedModel, setSelectedModel: handleModelSelect };
};

export const ChatInput = ({ status = 'idle', onSubmit, onTerminate }: ChatInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolsConfigDialogRef = useRef<InputToolsConfigDialogRef>(null);
  const modelSelectorRef = useRef<ModelSelectorRef>(null);
  const agentSelectorRef = useRef<AgentSelectorRef>(null);
  const [shouldPlan, setShouldPlan] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [availableAgents, setAvailableAgents] = useState<AgentInfo[]>([]);
  const { enabledTools } = useInputToolsConfig();
  const t = useTranslations('chat.input');
  const tConfirm = useTranslations('chat.confirm.terminate');

  const { selectedModel, setSelectedModel } = useAgentModelSelector();
  const { selectedAgent, setSelectedAgent } = useAgentSelectorStore('chat-input-agent-storage')();

  useEffect(() => {
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
  }, []);

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
            <DialogTitle>{tConfirm('title')}</DialogTitle>
            <DialogDescription>{tConfirm('description')}</DialogDescription>
          </DialogHeader>
        ),
        onConfirm: async () => {
          await onTerminate?.();
        },
        buttonText: {
          cancel: tConfirm('cancel'),
          confirm: tConfirm('confirm'),
          loading: tConfirm('terminating'),
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

  const getPlaceholder = () => {
    switch (status) {
      case 'thinking':
        return t('placeholderThinking');
      case 'terminating':
        return t('placeholderTerminating');
      case 'completed':
        return t('placeholderCompleted');
      default:
        return t('placeholder');
    }
  };

  const renderHeader = () => {
    return null;
  };

  const renderFooter = ({ message }: { message: string; handleSend: () => void | Promise<void>; disabled: boolean }) => (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        {/* <Tooltip>
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
        </Tooltip> */}
        <Badge variant="secondary" className="flex cursor-pointer items-center gap-1" onClick={() => modelSelectorRef.current?.open()}>
          <Wrench className="h-3 w-3" />
          <span>{selectedModel?.name || t('selectModel')}</span>
        </Badge>
        <Badge variant="secondary" className="flex cursor-pointer items-center gap-1" onClick={() => agentSelectorRef.current?.open()}>
          <Bot className="h-3 w-3" />
          <span>{selectedAgent?.name || t('selectAgent')}</span>
        </Badge>
        <Badge variant="secondary" className="flex cursor-pointer items-center gap-1" onClick={() => toolsConfigDialogRef.current?.open()}>
          <Wrench className="h-3 w-3" />
          <span>{t('tools')} {enabledTools.length ? `(${enabledTools.length})` : ''}</span>
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        {files.length > 0 && (
          <Badge variant="secondary" className="flex cursor-default items-center gap-1 py-1 pr-1 pl-2">
            <span>
              {files.length} {t('files')}
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
      <ModelSelectorDialog ref={modelSelectorRef} selectedModel={selectedModel} onModelSelect={handleModelSelect} />
      <AgentSelectorDialog
        ref={agentSelectorRef}
        availableAgents={availableAgents}
        selectedAgent={selectedAgent}
        onAgentSelect={handleAgentSelect}
        storageKey="chat-input-agent-storage"
      />
    </>
  );
};
