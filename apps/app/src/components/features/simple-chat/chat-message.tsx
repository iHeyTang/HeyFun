'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Markdown } from '@/components/block/markdown/markdown';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp: Date;
}

export const ChatMessage = ({ role, content, isStreaming = false, timestamp }: ChatMessageProps) => {
  const isUser = role === 'user';

  return (
    <div className={cn('flex gap-3 p-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('group flex w-full flex-col', isUser ? 'items-end' : 'items-start')}>
        <span className="group-hover:text-muted-foreground text-xs text-transparent transition-all">{timestamp.toLocaleTimeString()}</span>
        {content && (
          <div className={cn('bg-muted max-w-[70%] rounded-lg')}>
            <Markdown className="markdown-body">{content}</Markdown>
          </div>
        )}
      </div>

      {isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-secondary">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};
