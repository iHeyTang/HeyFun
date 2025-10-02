import { MediaPreview } from '@/components/block/media-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isAudioExtension, isImageExtension, isVideoExtension } from '@/lib/shared/file-type';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { formatDate } from 'date-fns';
import { Check, Clock, Copy, Download } from 'lucide-react';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { usePaintboardTasks, type PaintboardTask } from './use-paintboard-tasks';

export interface TaskHistoryRef {
  triggerRefresh: () => Promise<void>;
  addNewTask: (newTask: PaintboardTask) => void;
}

export const PaintboardTaskHistory = forwardRef<TaskHistoryRef>((props, ref) => {
  const { tasks, loading, loadingMore, error, hasMore, fetchTasks, loadMore, triggerRefresh, addNewTask } = usePaintboardTasks();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    triggerRefresh,
    addNewTask,
  }));

  // 滚动监听，接近底部时自动加载更多
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const threshold = 100; // 距离底部100px时触发加载

      if (scrollHeight - scrollTop - clientHeight < threshold && hasMore && !loadingMore && !loading) {
        loadMore();
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore, loading, loadMore]);

  if (loading && tasks.length === 0) {
    return (
      <div className="px-6 py-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border-border border-b py-4 last:border-b-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-secondary h-6 w-16 animate-pulse rounded"></div>
                <div className="bg-secondary h-6 w-12 animate-pulse rounded"></div>
                <div className="bg-secondary h-6 w-32 animate-pulse rounded"></div>
              </div>
              <div className="bg-secondary h-4 w-24 animate-pulse rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive mb-4">{error}</p>
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
            <div className="bg-secondary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-secondary text-sm font-medium">No task records</p>
            <p className="mt-1 text-xs">Your generation tasks will appear here</p>
          </div>
        </div>
      ) : (
        <div ref={scrollContainerRef} className="h-full overflow-y-auto">
          <div className="px-6 py-4">
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}

            {/* 加载更多指示器 */}
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="border-border border-t-primary h-4 w-4 animate-spin rounded-full border-2"></div>
                  加载更多...
                </div>
              </div>
            )}

            {/* 没有更多数据提示 */}
            {!hasMore && tasks.length > 0 && (
              <div className="flex justify-center py-4">
                <div className="text-sm">没有更多任务了</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

PaintboardTaskHistory.displayName = 'PaintboardTaskHistory';

interface TaskCardProps {
  task: PaintboardTask;
}

function TaskCard({ task }: TaskCardProps) {
  const [copied, setCopied] = React.useState(false);
  const prompt = 'prompt' in task.params ? task.params.prompt : 'text' in task.params ? task.params.text : '';
  const ratio = 'aspectRatio' in task.params ? task.params.aspectRatio : undefined;
  const model = task.model;

  return (
    <div className="border-border space-y-4 border-b py-4 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {model && (
            <Badge variant="secondary" className="font-mono">
              {model}
            </Badge>
          )}

          {ratio && (
            <Badge variant="secondary" className="text-xs">
              {ratio}
            </Badge>
          )}

          {prompt && (
            <div className="group relative" onMouseLeave={() => setCopied(false)}>
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="max-w-xs group-hover:pr-7">
                      <span className="truncate">{prompt}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-sm">{prompt}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {copied ? (
                <Check className="absolute top-[calc(50%+1px)] right-2 h-3 w-3 -translate-y-1/2 opacity-100" />
              ) : (
                <Copy
                  className="absolute top-[calc(50%+1px)] right-2 h-3 w-3 -translate-y-1/2 cursor-pointer opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100"
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

        <span className="ml-4 flex-shrink-0 text-xs">{formatDate(new Date(task.createdAt), 'yyyy-MM-dd HH:mm:ss')}</span>
      </div>

      {task.error ? (
        <div className="mt-2 text-xs">{task.error}</div>
      ) : task.results && task.results.length > 0 ? (
        <div className="flex gap-4">
          {task.results.map((result: any) => (
            <ResultCard key={result.key} result={result} />
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
  const aspectRatio = 'aspectRatio' in task.params ? task.params.aspectRatio || '1:1' : '1:1';

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
      className="border-border from-secondary to-tertiary relative overflow-hidden rounded-lg border bg-gradient-to-br"
      style={{ width: `${size.width}px`, height: `${size.height}px` }}
    >
      {/* 渐变银色流动动效 */}
      <div className="animate-gradient-flow absolute inset-0 bg-gradient-to-r from-gray-200/40 via-gray-300/60 to-gray-200/40" />
    </div>
  );
}

interface ResultCardProps {
  result: PaintboardTask['results'][number];
}

function ResultCard({ result }: ResultCardProps) {
  const isVideo = isVideoExtension(result.key);
  const isImage = isImageExtension(result.key);
  const isAudio = isAudioExtension(result.key);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 使用简化后的 signed URL hook
  const { getSignedUrl, error } = useSignedUrl();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  // 获取签名 URL
  useEffect(() => {
    const fetchSignedUrl = async () => {
      try {
        setLoading(true);
        setErrorState(null);
        const url = await getSignedUrl(result.key);
        setSignedUrl(url);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load media';
        setErrorState(errorMessage);
        console.error('Failed to get signed URL:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [result.key, getSignedUrl]);

  const handleMouseEnter = () => {
    if (videoRef.current && signedUrl) {
      videoRef.current.play().catch(() => {
        // 忽略播放错误，避免控制台报错
      });
    }
  };

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0; // 重置到开始位置
    }
  };

  // 加载状态
  if (loading) {
    return (
      <div className="bg-secondary flex h-48 w-full animate-pulse items-center justify-center rounded-lg">
        <div className="text-sm">Loading...</div>
      </div>
    );
  }

  // 错误状态
  const errorMsg = errorState || error(result.key);
  if (errorMsg || !signedUrl) {
    return (
      <div className="border-destructive bg-destructive/5 flex h-48 w-full items-center justify-center rounded-lg border">
        <div className="text-center">
          <div className="text-destructive mb-1 text-sm">Failed to load</div>
          <div className="text-destructive text-xs">{errorMsg || 'Unknown error'}</div>
        </div>
      </div>
    );
  }

  if (isVideo) {
    return (
      <MediaPreview src={signedUrl} alt={result.key} type="video" filename={result.key}>
        <div className="h-48 overflow-hidden rounded-lg" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <video ref={videoRef} src={signedUrl} controls={false} className="h-full w-full object-contain" muted loop>
            Your browser does not support the video tag.
          </video>
        </div>
      </MediaPreview>
    );
  }

  if (isImage) {
    return (
      <MediaPreview src={signedUrl} alt={result.key} type="image" filename={result.key}>
        <div className="h-48 overflow-hidden rounded-lg">
          <img src={signedUrl} alt={result.key} className="h-full w-full object-contain" />
        </div>
      </MediaPreview>
    );
  }

  if (isAudio) {
    return (
      <div className="overflow-hidden rounded-lg">
        <audio src={signedUrl} controls />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="overflow-hidden text-sm text-ellipsis whitespace-nowrap">{result.key.split('/').pop()}</div>
      <a href={signedUrl} download={result.key.split('/').pop()}>
        <Button size="sm" variant="outline" className="w-full">
          <Download className="h-3 w-3" />
          Download
        </Button>
      </a>
    </div>
  );
}
