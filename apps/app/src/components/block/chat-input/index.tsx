'use client';

import { Textarea } from '@/components/ui/textarea';
import { uploadFile, validateFile } from '@/lib/browser/file';
import { useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';

/**
 * 根据 MIME 类型判断附件类型
 */
function getAttachmentType(mimeType: string, fileName?: string): AttachmentType {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  // 文档类型
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('text') ||
    mimeType.includes('json') ||
    mimeType.includes('csv') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation') ||
    (fileName && /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md)$/i.test(fileName))
  ) {
    return 'document';
  }
  return 'file';
}

export type AttachmentType = 'image' | 'video' | 'audio' | 'document' | 'file';

export interface ChatInputAttachment {
  url: string; // OSS文件key或base64 URL（用于预览）
  fileKey?: string; // OSS文件key（如果已上传）
  type: AttachmentType; // 附件类型
  name?: string; // 文件名
  mimeType?: string; // MIME类型
  size?: number; // 文件大小（字节）
}

// 向后兼容
export type ChatInputImage = ChatInputAttachment;

export interface ChatInputProps {
  onSend: (message: string, attachments?: ChatInputAttachment[]) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  renderHeader?: () => React.ReactNode;
  renderFooter?: (params: {
    message: string;
    attachments: ChatInputAttachment[];
    handleSend: () => void | Promise<void>;
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveAttachment: (index: number) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    disabled: boolean;
  }) => React.ReactNode;
}

export const ChatInput = ({
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
  value: controlledValue,
  onValueChange,
  className,
  renderHeader,
  renderFooter,
}: ChatInputProps) => {
  const [internalValue, setInternalValue] = useState('');
  const [attachments, setAttachments] = useState<ChatInputAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isControlled = controlledValue !== undefined;
  const message = isControlled ? controlledValue : internalValue;

  const handleValueChange = (newValue: string) => {
    if (isControlled) {
      onValueChange?.(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  // 处理文件粘贴（支持图片）
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (disabled || uploading) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.kind === 'file') {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await handleFileUpload(file);
          }
          break;
        }
      }
    };

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('paste', handlePaste);
      return () => {
        textarea.removeEventListener('paste', handlePaste);
      };
    }
  }, [disabled, uploading]);

  // 处理文件上传（支持所有文件类型）
  const handleFileUpload = async (file: File) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const error = validateFile(file, undefined, maxSize);
    if (error) {
      toast.error(error);
      return;
    }

    const attachmentType = getAttachmentType(file.type, file.name);
    setUploading(true);
    try {
      // 对于图片，先显示预览（使用base64）
      let previewUrl: string;
      if (attachmentType === 'image') {
        const reader = new FileReader();
        previewUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = e => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        // 非图片文件，使用占位符
        previewUrl = '';
      }

      const tempAttachment: ChatInputAttachment = {
        url: previewUrl,
        type: attachmentType,
        name: file.name,
        mimeType: file.type,
        size: file.size,
      };

      setAttachments(prev => [...prev, tempAttachment]);

      try {
        // 上传到OSS
        const fileKey = await uploadFile(file, 'chat');
        // 更新为OSS key
        setAttachments(prev => prev.map(att => (att === tempAttachment ? { ...att, url: previewUrl || `/api/oss/${fileKey}`, fileKey } : att)));
      } catch (error) {
        console.error('Upload error:', error);
        toast.error('文件上传失败');
        // 移除失败的文件
        setAttachments(prev => prev.filter(att => att !== tempAttachment));
      } finally {
        setUploading(false);
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('文件处理失败');
      setUploading(false);
    }
  };

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file) {
          await handleFileUpload(file);
        }
      }
    }
    // 重置input，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 删除附件
  const onRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    const hasContent = trimmedMessage || attachments.length > 0;

    if (hasContent && !disabled && !uploading) {
      await onSend(trimmedMessage, attachments.length > 0 ? attachments : undefined);
      if (!isControlled) {
        setInternalValue('');
      } else {
        onValueChange?.('');
      }
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`pointer-events-none p-4 ${className || ''}`}>
      <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-2">
        {renderHeader && renderHeader()}
        <div className="dark:bg-background shadow-light flex w-full flex-col rounded-lg border shadow-lg">
          <div className="flex items-end gap-2 px-4 py-3">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={e => handleValueChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || uploading}
              className="max-h-[200px] min-h-[80px] flex-1 resize-none overflow-y-auto border-none bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
            />
          </div>
          {renderFooter && (
            <div className="border-border/50 border-t">
              {renderFooter({
                message,
                attachments,
                handleSend,
                handleFileSelect,
                onRemoveAttachment,
                fileInputRef,
                disabled: disabled || uploading,
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
