'use client';

import { Loader2, FileText } from 'lucide-react';
import { WysiwygEditor } from '@/components/block/wysiwyg-editor';

interface NoteReadResultProps {
  args?: Record<string, any>;
  result?: {
    noteId?: string;
    title?: string;
    content?: string;
    folderName?: string;
    tags?: Array<{ id: string; name: string; color?: string }>;
    createdAt?: string;
    updatedAt?: string;
  };
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

export function NoteReadResult({ args, result, status, error }: NoteReadResultProps) {
  if (status === 'running' || status === 'pending') {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-muted-foreground text-sm">正在读取笔记...</span>
      </div>
    );
  }

  if (status === 'error') {
    return <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">{error || '读取笔记失败'}</div>;
  }

  if (!result) {
    return null;
  }

  return (
    <div className="space-y-3">
      {result.title && <div className="text-sm font-medium">{result.title || args?.title}</div>}
      {result.folderName && <div className="text-muted-foreground text-xs">文件夹：{result.folderName}</div>}
      {result.content && (
        <WysiwygEditor
          value={result.content}
          readOnly={true}
          showToolbar={false}
          isStreaming={false}
          className="text-sm"
          editorClassName="p-0"
        />
      )}
    </div>
  );
}
