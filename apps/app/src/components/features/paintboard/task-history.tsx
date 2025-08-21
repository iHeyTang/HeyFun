import { PaintboardResult } from '@/actions/paintboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePaintboardTasks, type PaintboardTask } from '@/hooks/use-paintboard-tasks';
import { getImageUrl } from '@/lib/browser/image';
import { formatDate } from 'date-fns';
import { Check, Clock, Copy, Download } from 'lucide-react';
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { MediaPreview } from './media-preview';

// Check if file is video
const isVideoFile = (filename: string): boolean => {
  const videoExtensions = ['.mp4', '.avi', '.mov', '.webm'];
  return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

export interface TaskHistoryRef {
  triggerRefresh: () => Promise<void>;
}

export const PaintboardTaskHistory = forwardRef<TaskHistoryRef>((props, ref) => {
  const { tasks, loading, error, fetchTasks, pollResults, downloadFile, startPolling, startRealTimePolling, subscribeToRefresh, triggerRefresh } =
    usePaintboardTasks();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    triggerRefresh,
  }));

  // 订阅刷新事件
  useEffect(() => {
    const unsubscribe = subscribeToRefresh(() => {
      setRefreshTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, [subscribeToRefresh]);

  // 检查是否有进行中的任务，如果有则开始实时轮询
  useEffect(() => {
    const hasInProgressTasks = tasks.some(
      task => task.status === 'processing' || task.status === 'pending' || !task.results || task.results.length === 0,
    );

    if (hasInProgressTasks) {
      startRealTimePolling();
    }
  }, [tasks, startRealTimePolling]);

  const handlePollResults = async () => {
    try {
      await pollResults();
    } catch (error) {
      console.error('Error polling results:', error);
    }
  };

  const handleDownload = async (result: any, organizationId: string) => {
    try {
      await downloadFile(result.localPath, organizationId, result.filename);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleStartPolling = async () => {
    try {
      await startPolling();
    } catch (error) {
      console.error('Error starting polling:', error);
    }
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="px-6 py-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border-b border-gray-100 py-4 last:border-b-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-16 animate-pulse rounded bg-gray-100"></div>
                <div className="h-6 w-12 animate-pulse rounded bg-gray-100"></div>
                <div className="h-6 w-32 animate-pulse rounded bg-gray-100"></div>
              </div>
              <div className="h-4 w-24 animate-pulse rounded bg-gray-100"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4 text-red-500">{error}</p>
        <Button onClick={() => fetchTasks()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full">
      {tasks.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Clock className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">No task records</p>
            <p className="mt-1 text-xs text-slate-400">Your generation tasks will appear here</p>
          </div>
        </div>
      ) : (
        <div className="h-full overflow-y-auto">
          <div className="px-6 py-4">
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} onDownload={handleDownload} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

PaintboardTaskHistory.displayName = 'PaintboardTaskHistory';

interface TaskCardProps {
  task: PaintboardTask;
  onDownload: (result: any, organizationId: string) => void;
}

function TaskCard({ task, onDownload }: TaskCardProps) {
  const [copied, setCopied] = React.useState(false);
  const prompt = task.params?.prompt || task.params?.text || '';
  const ratio = task.params?.aspectRatio;
  const model = task.model;

  return (
    <div className="space-y-4 border-b border-gray-100 py-4 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {model && (
            <Badge variant="secondary" className="bg-gray-100 font-mono text-xs text-gray-700 hover:bg-gray-100">
              {model}
            </Badge>
          )}

          {ratio && (
            <Badge variant="secondary" className="bg-gray-100 text-xs text-gray-700 hover:bg-gray-100">
              {ratio}
            </Badge>
          )}

          {prompt && (
            <div className="group relative" onMouseLeave={() => setCopied(false)}>
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="max-w-xs bg-gray-100 text-xs text-gray-700 group-hover:pr-7 hover:bg-gray-100">
                      <span className="truncate">{prompt}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-sm">{prompt}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {copied ? (
                <Check className="absolute top-[calc(50%+1px)] right-2 h-3 w-3 -translate-y-1/2 text-gray-500 opacity-100" />
              ) : (
                <Copy
                  className="absolute top-[calc(50%+1px)] right-2 h-3 w-3 -translate-y-1/2 cursor-pointer text-gray-500 opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100"
                  onClick={e => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(prompt);
                    setCopied(true);
                  }}
                />
              )}
            </div>
          )}
        </div>

        <span className="ml-4 flex-shrink-0 text-xs text-gray-500">{formatDate(new Date(task.createdAt), 'yyyy-MM-dd HH:mm:ss')}</span>
      </div>

      {task.error ? (
        <div className="mt-2 text-xs text-gray-400">{task.error}</div>
      ) : task.results && task.results.length > 0 ? (
        <div className="flex gap-4">
          {task.results.map((result: PaintboardResult) => (
            <ResultCard key={result.id} result={result} onDownload={() => onDownload(result, task.organizationId)} />
          ))}
        </div>
      ) : (
        <LoadingPlaceholder task={task} />
      )}
    </div>
  );
}

// 进行中任务的占位符组件
interface LoadingPlaceholderProps {
  task: PaintboardTask;
}

function LoadingPlaceholder({ task }: LoadingPlaceholderProps) {
  const aspectRatio = task.params?.aspectRatio || '1:1';

  // 根据宽高比计算尺寸，与ResultCard中的图片尺寸保持一致
  const getPlaceholderSize = (ratio: string) => {
    // 使用固定高度192px (h-48)，与ResultCard中的图片高度一致
    const baseHeight = 192;
    const parts = ratio.split(':').map(Number);
    const w = parts[0] || 1;
    const h = parts[1] || 1;
    const aspectRatioValue = w / h;

    return { width: baseHeight * aspectRatioValue, height: baseHeight };
  };

  const size = getPlaceholderSize(aspectRatio);

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100"
      style={{ width: `${size.width}px`, height: `${size.height}px` }}
    >
      {/* 渐变银色流动动效 */}
      <div className="animate-gradient-flow absolute inset-0 bg-gradient-to-r from-gray-200/40 via-gray-300/60 to-gray-200/40" />
    </div>
  );
}

interface ResultCardProps {
  result: PaintboardResult;
  onDownload: () => void;
}

function ResultCard({ result, onDownload }: ResultCardProps) {
  const isVideo = isVideoFile(result.localPath);
  const isImage = isImageFile(result.localPath);

  if (isVideo) {
    return (
      <MediaPreview src={result.url} alt={result.filename} type="video" filename={result.filename} onDownload={onDownload}>
        <div className="h-48 overflow-hidden rounded-lg bg-black">
          <video src={result.url} controls className="h-full w-full object-contain">
            Your browser does not support the video tag.
          </video>
        </div>
      </MediaPreview>
    );
  }

  if (isImage) {
    return (
      <MediaPreview src={getImageUrl(result.localPath)} alt={result.filename} type="image" filename={result.filename} onDownload={onDownload}>
        <div className="h-48 overflow-hidden rounded-lg bg-black">
          <img src={getImageUrl(result.localPath)} alt={result.filename} className="h-full w-full object-contain" />
        </div>
      </MediaPreview>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="overflow-hidden text-sm text-ellipsis whitespace-nowrap">{result.filename}</div>
      <Button onClick={onDownload} size="sm" variant="outline">
        <Download className="h-3 w-3" />
        Download
      </Button>
    </div>
  );
}
