import React from 'react';
import { usePaintboardTasks, type PaintboardTask } from '@/hooks/use-paintboard-tasks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, RefreshCw, Play, CheckCircle, XCircle, Clock, Info, Eye, EyeOff } from 'lucide-react';
import { formatDate, formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { PaintboardResult } from '@/actions/paintboard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getImageUrl } from '@/lib/browser/image';

// Status icon mapping
const statusIcons = {
  pending: <Clock className="h-4 w-4" />,
  processing: <RefreshCw className="h-4 w-4 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
};

// Status color mapping
const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

// Service name mapping
const serviceNames = {
  wan: 'Wanxiang',
  doubao: 'Doubao',
  jimeng: 'Jimeng',
};

// Generation type mapping
const generationTypeNames = {
  'text-to-image': 'Text to Image',
  'image-to-image': 'Image to Image',
  'text-to-video': 'Text to Video',
  'image-to-video': 'Image to Video',
  'keyframe-to-video': 'Keyframe to Video',
};

// Check if file is media
const isMediaFile = (filename: string): boolean => {
  const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.avi', '.mov', '.webm'];
  return mediaExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

// Check if file is video
const isVideoFile = (filename: string): boolean => {
  const videoExtensions = ['.mp4', '.avi', '.mov', '.webm'];
  return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

export function PaintboardTaskHistory() {
  const { tasks, loading, error, fetchTasks, pollResults, downloadFile, startPolling } = usePaintboardTasks();

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
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4 text-red-500">{error}</p>
        <Button onClick={fetchTasks} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full space-y-4">
      {tasks.length === 0 ? (
        <div className="py-8 text-center text-gray-500">No task records</div>
      ) : (
        <div className="h-full space-y-6 overflow-y-auto p-4">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onDownload={handleDownload} />
          ))}
        </div>
      )}
    </div>
  );
}

interface TaskCardProps {
  task: PaintboardTask;
  onDownload: (result: any, organizationId: string) => void;
}

function TaskCard({ task, onDownload }: TaskCardProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-baseline gap-2">
            {serviceNames[task.service as keyof typeof serviceNames]} - {task.model}
            <span className="text-xs font-normal text-gray-500">{formatDate(new Date(task.createdAt), 'yyyy-MM-dd HH:mm:ss')}</span>
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-2">
                  <div className="space-y-2">
                    <h4 className="font-medium">Task Parameter Details</h4>
                    <pre>{JSON.stringify(task.params, null, 2)}</pre>
                  </div>
                  <p>
                    <strong>Task ID:</strong> {task.id}
                  </p>
                  <p>
                    <strong>Created At:</strong> {new Date(task.createdAt).toLocaleString('en-US')}
                  </p>
                  <p>
                    <strong>Updated At:</strong> {new Date(task.updatedAt).toLocaleString('en-US')}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Badge className={statusColors[task.status as keyof typeof statusColors]}>
          {statusIcons[task.status as keyof typeof statusColors]}
          <span className="ml-1">
            {task.status === 'pending' && 'Pending'}
            {task.status === 'processing' && 'Processing'}
            {task.status === 'completed' && 'Completed'}
            {task.status === 'failed' && 'Failed'}
          </span>
        </Badge>
      </div>

      {task.error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">Error: {task.error}</p>
        </div>
      ) : task.results && task.results.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(400px,1fr))] gap-4">
          {task.results.map((result: PaintboardResult) => (
            <ResultCard key={result.id} result={result} onDownload={() => onDownload(result, task.organizationId)} />
          ))}
        </div>
      ) : (
        <div className="flex h-[160px] w-[300px] items-center justify-center rounded-md border p-3"></div>
      )}
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
      <video src={result.url} controls className="h-full w-full rounded-lg object-cover">
        Your browser does not support the video tag.
      </video>
    );
  }

  if (isImage) {
    return <img src={getImageUrl(result.localPath)} alt={result.filename} className="h-full w-full rounded-lg object-cover" />;
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
