import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { uploadFile } from '@/lib/browser/file';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { VideoNodeActionData } from './processor';
import { VideoNodeTooltip, VideoNodeTooltipProps } from './tooltip';

interface VideoNodeProps {
  data: NodeData<VideoNodeActionData>;
  id: string;
}

export { VideoNodeProcessor } from './processor';

export default function VideoNode({ data, id }: VideoNodeProps) {
  const flowGraph = useFlowGraph();
  const [isUploading, setIsUploading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | undefined>(data.output?.videos?.[0]?.url);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);
  const status = useNodeStatusById(id);

  const handleUploadFIle = useCallback(async (file: File) => {
    const res = await uploadFile(file, 'flowcanvas');
    return res;
  }, []);

  // 监听data.output变化，强制更新组件状态
  useEffect(() => {
    const newVideoUrl = data.output?.videos?.[0]?.url;
    if (newVideoUrl !== videoUrl) {
      console.log(`VideoNode ${id} - 检测到输出数据变化:`, {
        oldUrl: videoUrl,
        newUrl: newVideoUrl,
        fullOutput: data.output,
        timestamp: new Date().toISOString(),
      });
      setVideoUrl(newVideoUrl);
    }
  }, [data.output, data.output?.videos, id, videoUrl, data]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    setIsUploading(true);

    try {
      const url = await handleUploadFIle(file);
      flowGraph.updateNodeData(id, { output: { videos: [{ url }] } });
    } catch (error) {
      console.error('Video upload failed:', error);
      alert('Video upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // 处理actionData变化
  const handleActionDataChange = useCallback<NonNullable<VideoNodeTooltipProps['onValueChange']>>(newActionData => {
    flowGraph.updateNodeData(id, { actionData: newActionData });
  }, []);

  // 处理tooltip提交
  const handleTooltipSubmit = useCallback<NonNullable<VideoNodeTooltipProps['onSubmitSuccess']>>(output => {
    flowGraph.updateNodeData(id, { output });
  }, []);

  // 处理鼠标移入事件 - 开始播放视频
  const handleMouseEnter = useCallback(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.play().catch(error => {
        console.warn('视频自动播放失败:', error);
      });
    }
  }, [videoUrl]);

  // 处理鼠标移出事件 - 暂停视频
  const handleMouseLeave = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  // 处理双击事件 - 全屏播放
  const handleDoubleClick = useCallback(() => {
    if (videoUrl) {
      setIsFullscreen(true);
    }
  }, [videoUrl]);

  // 关闭全屏
  const handleCloseFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  // 处理全屏视频播放状态同步
  useEffect(() => {
    if (isFullscreen && fullscreenVideoRef.current && videoRef.current) {
      // 同步播放状态
      if (!videoRef.current.paused) {
        fullscreenVideoRef.current.play().catch(console.warn);
      } else {
        fullscreenVideoRef.current.pause();
      }
    }
  }, [isFullscreen]);

  return (
    <>
      <BaseNode
        data={data}
        id={id}
        tooltip={
          <VideoNodeTooltip nodeId={id} value={data.actionData} onValueChange={handleActionDataChange} onSubmitSuccess={handleTooltipSubmit} />
        }
      >
        <div className="">
          {videoUrl ? (
            <div className="relative">
              {status.status === NodeStatus.PROCESSING && (
                <div className="bg-theme-background/50 absolute inset-0 z-10 flex items-center justify-center rounded backdrop-blur-sm">
                  <div className="flex flex-col items-center">
                    <Loader2 className="text-theme-chart-2 animate-spin" />
                  </div>
                </div>
              )}
              <video
                ref={videoRef}
                src={videoUrl}
                className="bg-theme-muted max-h-[200px] w-full cursor-pointer rounded"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onDoubleClick={handleDoubleClick}
                loop
              />
            </div>
          ) : (
            <div className="bg-theme-muted flex items-center justify-center rounded p-2 text-center transition-colors">
              {isUploading ? (
                <div className="text-theme-chart-2 flex flex-col items-center">
                  <div className="border-theme-border-primary border-t-theme-chart-2 mb-2 h-5 w-5 animate-spin rounded-full border-2"></div>
                  <span>Uploading...</span>
                </div>
              ) : (
                <div className="flex h-32 flex-col justify-center gap-1 space-y-1 p-4 text-sm">
                  <div className="cursor-pointer text-left" onClick={handleFileSelect}>
                    1. Upload local video (up to 100MB)
                  </div>
                  <div className="text-theme-muted-foreground text-left" onClick={() => {}}>
                    2. Enter prompt to generate a video
                  </div>
                </div>
              )}
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
      </BaseNode>

      {/* 全屏模态窗口 */}
      {isFullscreen && videoUrl && <FullscreenVideoModal videoUrl={videoUrl} onClose={handleCloseFullscreen} videoRef={fullscreenVideoRef} />}
    </>
  );
}

// 全屏视频模态窗口组件
function FullscreenVideoModal({
  videoUrl,
  onClose,
  videoRef,
}: {
  videoUrl: string;
  onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  return createPortal(
    <div className="bg-theme-background/90 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex h-full w-full items-center justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-auto max-h-full w-auto max-w-full rounded object-contain shadow-2xl"
          onClick={e => e.stopPropagation()}
          controls
          loop
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
          }}
        />
        <button
          className="bg-theme-muted/50 text-theme-foreground hover:bg-theme-muted/70 absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold transition-colors"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}
