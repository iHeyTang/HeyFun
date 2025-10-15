'use client';

import { ChatInput as BaseChatInput } from '@/components/block/chat-input/index';
import { ModelInfo, ModelSelectorDialog, ModelSelectorRef } from '@/components/features/model-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLLM } from '@/hooks/use-llm';
import { usePreferences } from '@/hooks/use-preferences';
import { Bot, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  onClearChat?: () => void;
  showClearChat?: boolean;
}

const useChatbotModelSelectorStore = create<{
  selectedModel: ModelInfo | null;
  setSelectedModel: (model: ModelInfo | null) => void;
}>()(set => ({
  selectedModel: null,
  setSelectedModel: model => {
    set({ selectedModel: model });
  },
}));

export const useChatbotModelSelector = () => {
  const { availableModels } = useLLM();
  const { data: preferences, update: updatePreferences } = usePreferences();
  const { selectedModel, setSelectedModel } = useChatbotModelSelectorStore();

  useEffect(() => {
    if (preferences?.defaultChatbotModel && !selectedModel) {
      const model = availableModels.find(m => m.id === preferences.defaultChatbotModel?.id) || null;
      setSelectedModel(model);
    }
  }, [availableModels, preferences?.defaultChatbotModel, selectedModel, setSelectedModel]);

  const handleModelSelect = async (model: ModelInfo) => {
    await updatePreferences({ defaultChatbotModel: model });
    setSelectedModel(model);
  };

  return { selectedModel, setSelectedModel: handleModelSelect };
};

export const ChatInput = ({ onSend, disabled = false, onClearChat, showClearChat = false }: ChatInputProps) => {
  const modelSelectorRef = useRef<ModelSelectorRef>(null);
  const { selectedModel, setSelectedModel } = useChatbotModelSelector();

  const handleModelSelect = (model: ModelInfo) => {
    setSelectedModel(model);
  };

  const renderFooter = ({
    message,
    handleSend,
    disabled: footerDisabled,
  }: {
    message: string;
    handleSend: () => void | Promise<void>;
    disabled: boolean;
  }) => (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="flex cursor-pointer items-center gap-1" onClick={() => modelSelectorRef.current?.open()}>
          <Bot className="h-3 w-3" />
          <span>{selectedModel?.name || 'Select Model'}</span>
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        {showClearChat && onClearChat && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 cursor-pointer rounded-xl"
            onClick={onClearChat}
            aria-label="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 cursor-pointer rounded-xl"
          onClick={handleSend}
          disabled={footerDisabled || !message.trim()}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <BaseChatInput
        onSend={onSend}
        disabled={disabled}
        placeholder={disabled ? 'AI is responding...' : 'Type your message...'}
        renderFooter={renderFooter}
      />
      <ModelSelectorDialog ref={modelSelectorRef} selectedModel={selectedModel} onModelSelect={handleModelSelect} />
    </>
  );
};
