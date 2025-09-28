'use client';

import { Textarea } from '@/components/ui/textarea';
import { useRef, useState } from 'react';

export interface ChatInputProps {
  onSend: (message: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  renderHeader?: () => React.ReactNode;
  renderFooter?: (params: { message: string; handleSend: () => void | Promise<void>; disabled: boolean }) => React.ReactNode;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isControlled = controlledValue !== undefined;
  const message = isControlled ? controlledValue : internalValue;

  const handleValueChange = (newValue: string) => {
    if (isControlled) {
      onValueChange?.(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      await onSend(trimmedMessage);
      if (!isControlled) {
        setInternalValue('');
      } else {
        onValueChange?.('');
      }
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
        <div className="bg-background dark:bg-background flex w-full flex-col rounded-lg shadow-light dark:border">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={e => handleValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[80px] flex-1 resize-none border-none bg-transparent px-4 py-3 shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
          />
          {renderFooter && <div className="border-border/50 border-t">{renderFooter({ message, handleSend, disabled })}</div>}
        </div>
      </div>
    </div>
  );
};
