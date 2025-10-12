import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { uploadFile } from '@/lib/browser/file';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoNodeActionData } from './processor';
import { VideoNodeTooltip, VideoNodeTooltipProps } from './tooltip';
import { VideoPreview } from '@/components/block/preview/video-preview';

interface VideoNodeProps {
  data: NodeData<VideoNodeActionData>;
  id: string;
}

export { VideoNodeProcessor } from './processor';

export default function VideoNode({ data, id }: VideoNodeProps) {
  const flowGraph = useFlowGraph();
  const [isUploading, setIsUploading] = useState(false);
  const [videoKey, setVideoKey] = useState<string | undefined>(data.output?.videos?.[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = useNodeStatusById(id);

  const handleUploadFIle = useCallback(async (file: File) => {
    const res = await uploadFile(file, 'flowcanvas');
    return res;
  }, []);

  // 监听data.output变化，强制更新组件状态
  useEffect(() => {
    const newVideoKey = data.output?.videos?.[0];
    if (newVideoKey !== videoKey) {
      console.log(`VideoNode ${id} - 检测到输出数据变化:`, {
        oldKey: videoKey,
        newKey: newVideoKey,
        fullOutput: data.output,
        timestamp: new Date().toISOString(),
      });
      setVideoKey(newVideoKey);
    }
  }, [data.output, data.output?.videos, id, videoKey, data]);

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
      const key = await handleUploadFIle(file);
      flowGraph.updateNodeData(id, { output: { videos: [key] } });
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

  return (
    <>
      <BaseNode
        data={data}
        id={id}
        tooltip={
          <VideoNodeTooltip nodeId={id} value={data.actionData} onValueChange={handleActionDataChange} onSubmitSuccess={handleTooltipSubmit} />
        }
      >
        <div className="relative">
          {status.status === NodeStatus.PROCESSING && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded">
              {/* 高斯模糊蒙版 */}
              <div className="bg-accent/20 absolute inset-0 rounded backdrop-blur-lg"></div>
              {/* Loading动画 */}
              <div className="relative z-10 flex flex-col items-center justify-center">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
              </div>
            </div>
          )}

          {videoKey ? (
            <VideoPreview
              src={`/api/oss/${videoKey}`}
              autoPlayOnHover={true}
              className="bg-muted max-h-[200px] w-full rounded"
              loop
            />
          ) : (
            <div className="bg-muted flex items-center justify-center rounded p-2 text-center transition-colors">
              {isUploading ? (
                <div className="text-chart-2 flex flex-col items-center">
                  <div className="border-border-primary border-t-chart-2 mb-2 h-5 w-5 animate-spin rounded-full border-2"></div>
                  <span>Uploading...</span>
                </div>
              ) : (
                <div className="flex h-32 flex-col justify-center gap-1 space-y-1 p-4 text-sm">
                  <div className="cursor-pointer text-left" onClick={handleFileSelect}>
                    1. Upload local video (up to 100MB)
                  </div>
                  <div className="text-muted-foreground text-left" onClick={() => {}}>
                    2. Enter prompt to generate a video
                  </div>
                </div>
              )}
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
      </BaseNode>
    </>
  );
}
