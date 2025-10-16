import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { uploadFile } from '@/lib/browser/file';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoNodeActionData } from './processor';
import { VideoNodeTooltip, VideoNodeTooltipProps } from './tooltip';
import { VideoPreview } from '@/components/block/preview/video-preview';
import { NodeResizer } from '@xyflow/react';
import { useTranslations } from 'next-intl';

interface VideoNodeProps {
  data: NodeData<VideoNodeActionData>;
  id: string;
}

export { VideoNodeProcessor } from './processor';

export default function VideoNode({ data, id }: VideoNodeProps) {
  const t = useTranslations('flowcanvas.nodes');
  const flowGraph = useFlowGraph();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = useNodeStatusById(id);

  const handleUploadFIle = useCallback(async (file: File) => {
    const res = await uploadFile(file, 'flowcanvas');
    return res;
  }, []);

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
      flowGraph.updateNodeData(id, { output: { videos: { list: [key, ...(data.output?.videos?.list || [])], selected: key } } });
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
    <BaseNode
      data={data}
      id={id}
      tooltip={<VideoNodeTooltip nodeId={id} value={data.actionData} onValueChange={handleActionDataChange} onSubmitSuccess={handleTooltipSubmit} />}
    >
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

      {data.output?.videos?.selected ? (
        <div>
          <NodeResizer
            lineStyle={{ border: 'none', backgroundColor: 'transparent' }}
            handleStyle={{ border: 'none', backgroundColor: 'transparent' }}
            keepAspectRatio={true}
          />
          <VideoPreview
            src={`/api/oss/${data.output?.videos?.selected}`}
            autoPlayOnHover={true}
            className="mx-auto block h-full min-h-16 w-full min-w-16 rounded"
            loop
          />
        </div>
      ) : (
        <div className="bg-muted flex h-full w-full items-center justify-center rounded p-2 text-center transition-colors">
          {isUploading ? (
            <div className="text-chart-2 flex flex-col items-center">
              <div className="border-border-primary border-t-chart-2 mb-2 h-5 w-5 animate-spin rounded-full border-2"></div>
              <span>{t('uploading')}</span>
            </div>
          ) : (
            <div className="flex flex-col justify-center gap-1 space-y-1 p-4 text-sm">
              <div className="cursor-pointer text-left" onClick={handleFileSelect}>
                1. {t('uploadVideo')}
              </div>
              <div className="text-muted-foreground text-left" onClick={() => {}}>
                2. {t('generateVideo')}
              </div>
            </div>
          )}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} style={{ display: 'none' }} />
    </BaseNode>
  );
}
