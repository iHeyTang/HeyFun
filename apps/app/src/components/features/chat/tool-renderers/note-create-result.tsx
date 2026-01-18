'use client';

import { Loader2 } from 'lucide-react';
import { NoteContentPreview } from '@/components/block/preview/note-preview';

interface NoteCreateResultProps {
  args?: Record<string, any>;
  result?: {
    noteId?: string;
    title?: string;
    assetId?: string;
  };
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

export function NoteCreateResult({ args, result, status, error }: NoteCreateResultProps) {
  if (status === 'running' || status === 'pending') {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-muted-foreground text-sm">正在创建笔记...</span>
      </div>
    );
  }

  if (status === 'error') {
    return <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">{error || '创建笔记失败'}</div>;
  }

  if (!result) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{result.title || args?.title}</div>
      {result.noteId && <NoteContentPreview noteId={result.noteId} className="text-sm" />}
    </div>
  );
}
