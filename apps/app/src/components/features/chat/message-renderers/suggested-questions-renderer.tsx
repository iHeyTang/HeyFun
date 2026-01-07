/**
 * 建议追问消息渲染器
 */

'use client';

import { ArrowRight, MessageSquareIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MessageRendererProps } from './types';

interface SuggestedQuestionsData {
  type: 'suggested_questions';
  questions: string[];
}

export function SuggestedQuestionsRenderer({ data, onSendMessage, isLastMessage }: MessageRendererProps) {
  const suggestedQuestions = data as SuggestedQuestionsData;
  const t = useTranslations('chat.messages');

  // 如果不是最后一条消息，则不渲染这条消息
  if (!isLastMessage) {
    return null;
  }

  return (
    <div className="flex min-w-0 gap-3 px-4">
      {/* 占位，保持与assistant消息对齐 */}
      <div className="h-8 w-8 flex-shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-border/20 bg-muted/20 max-w-[70%] rounded-lg border px-4 py-3">
          <div className="text-muted-foreground mb-2 ml-3 text-xs font-medium">{t('suggestedQuestions')}</div>
          {suggestedQuestions.questions.map((question, index) => (
            <div
              key={index}
              onClick={() => {
                if (onSendMessage) {
                  onSendMessage(question);
                }
              }}
              className="hover:bg-muted-foreground/10 flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageSquareIcon className="text-muted-foreground h-3 w-3" />
                {question}
              </div>
              <ArrowRight className="h-3 w-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

