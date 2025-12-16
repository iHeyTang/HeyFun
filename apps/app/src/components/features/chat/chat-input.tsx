'use client';

import { ChatInput as BaseChatInput, ChatInputAttachment } from '@/components/block/chat-input/index';
import { ModelSelectorDialog, ModelSelectorRef } from '@/components/features/model-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLLM } from '@/hooks/use-llm';
import { usePreferences } from '@/hooks/use-preferences';
import { ModelInfo } from '@repo/llm/chat';
import { ImageIcon, Send, Trash2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { ModelIcon } from '../model-icon';
import { ImagePreview } from '@/components/block/preview/image-preview';

interface ChatInputProps {
  onSend: (message: string, attachments?: ChatInputAttachment[]) => void;
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
    attachments,
    handleSend,
    handleFileSelect,
    onRemoveAttachment,
    fileInputRef,
    disabled: footerDisabled,
  }: {
    message: string;
    attachments: ChatInputAttachment[];
    handleSend: () => void | Promise<void>;
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveAttachment: (index: number) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    disabled: boolean;
  }) => {
    const hasContent = message.trim() || attachments.length > 0;

    return (
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex cursor-pointer items-center gap-1" onClick={() => modelSelectorRef.current?.open()}>
            <ModelIcon family={selectedModel?.family} className="h-4 w-4" />
            <span>{selectedModel?.name || 'Select Model'}</span>
          </Badge>
          {/* 附件预览 */}
          {attachments.length > 0 && (
            <div className="flex gap-2">
              {attachments.map((attachment, index) => {
                // 只显示图片预览，其他类型显示文件名
                if (attachment.type === 'image' && attachment.url) {
                  const isBase64 = attachment.url.startsWith('data:');
                  const imageUrl = isBase64 ? attachment.url : attachment.url;

                  return (
                    <div key={index} className="group relative h-[22px] w-[22px] flex-shrink-0">
                      <ImagePreview
                        src={imageUrl}
                        alt={`Preview ${index + 1}`}
                        width={22}
                        height={22}
                        className="h-[22px] w-[22px] rounded object-cover"
                      />
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          e.preventDefault();
                          onRemoveAttachment(index);
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 absolute -right-1 -top-1 flex h-[10px] w-[10px] cursor-pointer items-center justify-center rounded-full opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                        disabled={footerDisabled}
                      >
                        <X className="h-[8px] w-[8px]" />
                      </button>
                    </div>
                  );
                } else {
                  // 非图片附件，显示文件名
                  return (
                    <div key={index} className="group relative flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs">
                      <span className="max-w-[100px] truncate">{attachment.name || `附件 ${index + 1}`}</span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          e.preventDefault();
                          onRemoveAttachment(index);
                        }}
                        className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center justify-center"
                        disabled={footerDisabled}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                }
              })}
            </div>
          )}
          {/* 文件上传按钮 */}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} disabled={footerDisabled} />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={footerDisabled}
            aria-label="Upload file"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
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
            disabled={footerDisabled || !hasContent}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <BaseChatInput
        onSend={onSend}
        disabled={disabled}
        placeholder={disabled ? 'AI is responding...' : 'Type your message...'}
        renderFooter={renderFooter}
      />
      <ModelSelectorDialog ref={modelSelectorRef} selectedModel={selectedModel} onModelSelect={handleModelSelect} type="language" />
    </>
  );
};
