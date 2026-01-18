/**
 * 中断消息渲染器
 */

'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MessageRendererProps } from './types';

interface CancelData {
  type: 'cancel';
  origin: 'user' | 'system';
}

export function CancelRenderer({ data }: MessageRendererProps) {
  const cancelData = data as CancelData;
  const t = useTranslations('chat.messages');

  return (
    <div className="flex min-w-0 gap-3 px-4">
      {/* 占位，保持与assistant消息对齐 */}
      <div className="h-8 w-8 flex-shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-border/20 bg-muted/20 flex w-fit items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs">
          <X className="text-muted-foreground h-3 w-3" />
          <span className="text-muted-foreground/70">{cancelData.origin === 'user' ? t('cancelledByUser') : t('cancelledBySystem')}</span>
        </div>
      </div>
    </div>
  );
}
