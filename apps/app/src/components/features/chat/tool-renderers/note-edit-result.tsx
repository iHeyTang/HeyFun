'use client';

import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { NoteContentPreview } from '@/components/block/preview/note-preview';

interface NoteEditResultProps {
  args?: Record<string, any>;
  result?: {
    noteId?: string;
    title?: string;
    editCount?: number;
    failedEdits?: Array<{ oldText: string; newText: string; reason: string }>;
  };
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

export function NoteEditResult({ args, result, status, error }: NoteEditResultProps) {
  const noteId = result?.noteId || args?.noteId;

  if (status === 'running' || status === 'pending') {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-muted-foreground text-sm">正在编辑笔记...</span>
      </div>
    );
  }

  if (status === 'error') {
    return <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">{error || '编辑笔记失败'}</div>;
  }

  if (!result) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {result.failedEdits && result.failedEdits.length > 0 ? (
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
        )}
        <div className="text-sm font-medium">{result.title || args?.title}</div>
      </div>
      {result.editCount !== undefined && <div className="text-muted-foreground text-xs">成功执行 {result.editCount} 个编辑操作</div>}
      {result.failedEdits && result.failedEdits.length > 0 && (
        <div className="text-muted-foreground rounded-md bg-yellow-50 p-2 text-xs dark:bg-yellow-900/20">
          部分编辑操作失败：{result.failedEdits.length} 个
        </div>
      )}
      {noteId && <NoteContentPreview noteId={noteId} className="text-sm" />}
    </div>
  );
}
