'use client';

import { ChatInput as BaseChatInput, ChatInputAttachment } from '@/components/block/chat-input/index';
import { ImagePreview } from '@/components/block/preview/image-preview';
import { ModelSelectorDialog, ModelSelectorRef } from '@/components/features/model-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatSessionsStore } from '@/hooks/use-chat-sessions';
import { useLLM } from '@/hooks/use-llm';
import { usePreferences } from '@/hooks/use-preferences';
import { ModelInfo } from '@/llm/chat';
import { ArrowUp, FileIcon, Loader2, Plus, StopCircle, X, FolderOpen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { ModelIcon } from '../model-icon';
import { AssetsDialog } from './assets-dialog';

interface ChatInputProps {
  sessionId: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    cachedOutputTokens: number;
  };
  onSend: (message: string, attachments?: ChatInputAttachment[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  onCancel?: () => void;
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

export const ChatInput = ({
  sessionId,
  usage,
  onSend,
  disabled = false,
  isLoading = false,
  className,
  onCancel,
}: ChatInputProps) => {
  const modelSelectorRef = useRef<ModelSelectorRef>(null);
  const { selectedModel, setSelectedModel } = useChatbotModelSelector();
  const [assetsDialogOpen, setAssetsDialogOpen] = useState(false);

  // 从 store 获取输入值和附件
  const { sessionInputValues, sessionAttachments, setSessionInputValue, setSessionAttachments } = useChatSessionsStore();
  const inputValue = sessionInputValues[sessionId] || '';
  const attachments = sessionAttachments[sessionId] || [];

  // 输入值和附件管理（直接从 store 读取和更新）
  const handleInputValueChange = (value: string) => {
    setSessionInputValue(sessionId, value);
  };

  const handleAttachmentsChange = (newAttachments: ChatInputAttachment[]) => {
    setSessionAttachments(sessionId, newAttachments);
  };

  const handleModelSelect = (model: ModelInfo) => {
    setSelectedModel(model);
  };

  const renderHeader = () => {
    if (!usage) {
      return null;
    }
    return (
      <div className="text-muted-foreground/60 flex items-center gap-2 px-2 text-xs">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 flex-shrink-0"
          onClick={() => setAssetsDialogOpen(true)}
          disabled={disabled}
          aria-label="查看素材库"
          title="查看素材库"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span>输入: {usage.inputTokens.toLocaleString()} tokens</span>
          <span>输出: {usage.outputTokens.toLocaleString()} tokens</span>
          <span>缓存输入: {usage.cachedInputTokens.toLocaleString()} tokens</span>
          <span>缓存输出: {usage.cachedOutputTokens.toLocaleString()} tokens</span>
        </div>
      </div>
    );
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
            <Plus className="h-4 w-4" />
          </Button>
          {/* 附件预览 */}
          {attachments.length > 0 && (
            <div className="flex gap-2">
              {attachments.map((attachment, index) => {
                // 图片预览
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
                  // 非图片附件，使用和图片一样的样式
                  return (
                    <Tooltip key={index}>
                      <TooltipTrigger asChild>
                        <div className="group relative h-[22px] w-[22px] flex-shrink-0">
                          <div className="bg-muted/50 flex h-[22px] w-[22px] items-center justify-center rounded border">
                            <FileIcon className="text-muted-foreground h-3 w-3" />
                          </div>
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
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>{attachment.name || `附件 ${index + 1}`}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex cursor-pointer items-center gap-1" onClick={() => modelSelectorRef.current?.open()}>
            <ModelIcon family={selectedModel?.family} className="h-4 w-4" />
            <span>{selectedModel?.name || 'Select Model'}</span>
          </Badge>
          {isLoading ? (
            <Button
              type="button"
              size="icon"
              className="h-6 w-6 cursor-pointer rounded-full"
              onClick={onCancel}
              disabled={false}
              aria-label="Cancel message"
              title="停止生成"
            >
              <div className="bg-background h-2 w-2 rounded-[2px]" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              className="h-6 w-6 cursor-pointer rounded-full"
              onClick={handleSend}
              disabled={footerDisabled || !hasContent || isLoading}
              aria-label="Send message"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <BaseChatInput
        onSend={onSend}
        disabled={disabled || isLoading}
        placeholder={isLoading ? '正在处理中...' : disabled ? 'AI is responding...' : 'Type your message...'}
        renderHeader={renderHeader}
        renderFooter={renderFooter}
        value={inputValue}
        onValueChange={handleInputValueChange}
        attachments={attachments}
        onAttachmentsChange={handleAttachmentsChange}
        className={className}
      />
      <ModelSelectorDialog ref={modelSelectorRef} selectedModel={selectedModel} onModelSelect={handleModelSelect} type="language" />
      <AssetsDialog sessionId={sessionId} open={assetsDialogOpen} onOpenChange={setAssetsDialogOpen} />
    </>
  );
};
