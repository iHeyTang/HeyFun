'use client';

import { PresentationPreview } from '@/components/block/preview/presentation-preview';
import { Loader2 } from 'lucide-react';

interface PresentationResultProps {
  args?: Record<string, any>;
  result?: {
    htmlUrl?: string;
    pptxUrl?: string;
    fileKeys?: string[];
  };
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

export function PresentationResult({ args, result, status, error }: PresentationResultProps) {
  if (status === 'running' || status === 'pending') {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">正在生成演示文稿...</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
        {error || '生成演示文稿失败'}
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="py-2">
      <PresentationPreview htmlUrl={result.htmlUrl} pptxUrl={result.pptxUrl} title={args?.title} />
    </div>
  );
}

