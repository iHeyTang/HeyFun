'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { uploadFile, validateFile } from '@/lib/browser/file';
import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { createNoteMentionExtension, parseNoteMention, type NoteMentionData } from './note-mention-extension';
import { cn } from '@/lib/utils';
import TurndownService from 'turndown';

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
  attachments?: ChatInputAttachment[];
  onAttachmentsChange?: (attachments: ChatInputAttachment[]) => void;
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
  attachments: controlledAttachments,
  onAttachmentsChange,
  className,
  renderHeader,
  renderFooter,
}: ChatInputProps) => {
  const [internalAttachments, setInternalAttachments] = useState<ChatInputAttachment[]>([]);
  const isAttachmentsControlled = controlledAttachments !== undefined;
  const attachments = isAttachmentsControlled ? controlledAttachments : internalAttachments;
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messageText, setMessageText] = useState('');
  const handleSendRef = useRef<(() => Promise<void>) | null>(null);

  const isControlled = controlledValue !== undefined;

  // 初始化 Turndown 服务（用于 HTML 转 Markdown）
  const turndownService = useMemo(() => {
    const service = new TurndownService();
    // 添加自定义规则：将 note mention 转换为文本格式
    service.addRule('noteMention', {
      filter: (node: any) => {
        return (
          node.nodeName === 'SPAN' &&
          (node.getAttribute('data-type') === 'mention' ||
            node.getAttribute('data-type') === 'note-mention' ||
            node.classList?.contains('note-mention'))
        );
      },
      replacement: (content: string, node: any) => {
        // 优先从 data-note-mention 获取（已经是新格式）
        const mentionText = node.getAttribute('data-note-mention') || '';
        if (mentionText) {
          // 直接返回文本格式，用于发送给 AI
          return mentionText;
        }
        // 如果没有 mentionText，尝试从其他属性构建
        const noteId = node.getAttribute('data-note-id') || 'unknown';
        const noteContent = node.getAttribute('data-note-content') || '';
        // 尝试从文本内容解析行数（如果存在）
        const textContent = node.textContent || '';
        const lineMatch = textContent.match(/:(\d+)(?:-(\d+))?/);
        if (lineMatch) {
          const startLine = lineMatch[1];
          const endLine = lineMatch[2];
          const positionInfo = endLine ? `${startLine}:${endLine}` : startLine;
          return `@note:${noteId}[${positionInfo}]${noteContent ? `[${noteContent}]` : ''}`;
        }
        // 如果都找不到，返回默认格式
        return `@note:${noteId}[1]${noteContent ? `[${noteContent}]` : ''}`;
      },
    });
    return service;
  }, []);

  // 创建 Tiptap 编辑器
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 禁用一些不需要的功能
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      createNoteMentionExtension(),
    ],
    content: controlledValue || '',
    editable: !disabled && !uploading,
    immediatelyRender: false, // 避免 SSR hydration 错误
    editorProps: {
      attributes: {
        class: cn(
          'max-h-[200px] min-h-[80px] flex-1 resize-none overflow-y-auto',
          'border-none bg-transparent shadow-none outline-none',
          'focus-visible:ring-0 focus-visible:ring-offset-0',
          'dark:bg-transparent',
          'prose prose-sm max-w-none',
          'px-0 py-2',
        ),
      },
      handleKeyDown: (view, event) => {
        // 检查是否为 Command+Enter (Mac) 或 Ctrl+Enter (Windows/Linux)
        const isModifierPressed = event.metaKey || event.ctrlKey;
        if (event.key === 'Enter' && isModifierPressed) {
          event.preventDefault();
          handleSendRef.current?.();
          return true; // 阻止默认行为
        }
        return false; // 允许其他按键的默认行为
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      setMessageText(text);
      if (isControlled) {
        onValueChange?.(html);
      }
    },
  });

  // 同步外部 value 变化到编辑器
  useEffect(() => {
    if (editor && controlledValue !== undefined) {
      const currentHTML = editor.getHTML();
      const currentText = editor.getText();
      // 比较 HTML 和纯文本，确保内容真正变化时才更新
      const valueChanged = controlledValue !== currentHTML && controlledValue !== currentText;

      if (valueChanged) {
        // 使用 setTimeout 延迟执行，避免在 React 渲染周期中调用 flushSync
        const timeoutId = setTimeout(() => {
          if (editor && controlledValue !== undefined) {
            const newCurrentHTML = editor.getHTML();
            const newCurrentText = editor.getText();
            // 再次检查，避免重复更新
            if (controlledValue !== newCurrentHTML && controlledValue !== newCurrentText) {
              editor.commands.setContent(controlledValue, { emitUpdate: false });
              // 立即更新消息文本状态，确保发送按钮状态正确
              const updatedText = editor.getText();
              setMessageText(updatedText);
            }
          }
        }, 0);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [editor, controlledValue]);

  // 同步外部附件列表变化
  useEffect(() => {
    if (isAttachmentsControlled && controlledAttachments !== undefined) {
      // 附件列表由外部控制，不需要内部同步
    }
  }, [isAttachmentsControlled, controlledAttachments]);

  // 同步 disabled 状态
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled && !uploading);
    }
  }, [editor, disabled, uploading]);

  // 获取当前消息文本（用于发送和显示）
  // 使用状态中的 messageText，确保在快速填入后能立即反映
  const message = messageText;
  const messageHTML = editor ? editor.getHTML() : '';

  // 初始化 messageText
  useEffect(() => {
    if (editor) {
      setMessageText(editor.getText());
    }
  }, [editor]);

  const handleValueChange = (newValue: string) => {
    if (editor) {
      editor.commands.setContent(newValue, { emitUpdate: false });
    }
    if (isControlled) {
      onValueChange?.(newValue);
    }
  };

  // 处理文件上传（支持所有文件类型）
  const handleFileUpload = useCallback(
    async (file: File) => {
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

        const newAttachments = [...attachments, tempAttachment];
        if (isAttachmentsControlled) {
          onAttachmentsChange?.(newAttachments);
        } else {
          setInternalAttachments(newAttachments);
        }

        try {
          // 上传到OSS
          const fileKey = await uploadFile(file, 'chat');
          // 更新为OSS key
          const updatedAttachments = newAttachments.map(att =>
            att === tempAttachment ? { ...att, url: previewUrl || `/api/oss/${fileKey}`, fileKey } : att,
          );
          if (isAttachmentsControlled) {
            onAttachmentsChange?.(updatedAttachments);
          } else {
            setInternalAttachments(updatedAttachments);
          }
        } catch (error) {
          console.error('Upload error:', error);
          toast.error('文件上传失败');
          // 移除失败的文件
          const filteredAttachments = newAttachments.filter(att => att !== tempAttachment);
          if (isAttachmentsControlled) {
            onAttachmentsChange?.(filteredAttachments);
          } else {
            setInternalAttachments(filteredAttachments);
          }
        } finally {
          setUploading(false);
        }
      } catch (error) {
        console.error('File upload error:', error);
        toast.error('文件处理失败');
        setUploading(false);
      }
    },
    [attachments, isAttachmentsControlled, onAttachmentsChange],
  );

  // 处理文件粘贴（支持图片）- 在 Tiptap 编辑器中处理
  useEffect(() => {
    if (!editor) return;

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

    const editorElement = editor.view.dom;
    editorElement.addEventListener('paste', handlePaste);
    return () => {
      editorElement.removeEventListener('paste', handlePaste);
    };
  }, [editor, disabled, uploading, handleFileUpload]);

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
    const newAttachments = attachments.filter((_, i) => i !== index);
    if (isAttachmentsControlled) {
      onAttachmentsChange?.(newAttachments);
    } else {
      setInternalAttachments(newAttachments);
    }
  };

  // 处理发送消息
  const handleSend = useCallback(async () => {
    if (!editor) return;

    const textContent = editor.getText().trim();
    const htmlContent = editor.getHTML();
    const hasContent = textContent || attachments.length > 0;

    if (hasContent && !disabled && !uploading) {
      const markdownContent = turndownService.turndown(htmlContent);
      await onSend(markdownContent, attachments.length > 0 ? attachments : undefined);
      editor.commands.clearContent();
      if (isControlled) {
        onValueChange?.('');
      }
      if (isAttachmentsControlled) {
        onAttachmentsChange?.([]);
      } else {
        setInternalAttachments([]);
      }
    }
  }, [editor, disabled, uploading, attachments, onSend, isControlled, onValueChange, isAttachmentsControlled, onAttachmentsChange, turndownService]);

  // 更新 ref，使 handleKeyDown 可以访问最新的 handleSend
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn('pointer-events-none py-4', className)}>
      <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-2">
        {renderHeader && renderHeader()}
        <div className="dark:bg-background flex w-full flex-col rounded-3xl border">
          <div className="flex items-end gap-2 px-4 py-3">
            {/* Tiptap 编辑器 */}
            <EditorContent editor={editor} className="flex-1" />
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
