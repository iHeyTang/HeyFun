import { AudioPlayer } from '@/components/block/audio-player';
import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { uploadFile } from '@/lib/browser/file';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioNodeActionData } from './processor';
import { AudioNodeTooltip, AudioNodeTooltipProps } from './tooltip';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface AudioNodeProps {
  data: NodeData<AudioNodeActionData>;
  id: string;
}

export { AudioNodeProcessor } from './processor';

export default function AudioNode({ data, id }: AudioNodeProps) {
  const t = useTranslations('flowcanvas.nodes');

  const flowGraph = useFlowGraph();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = useNodeStatusById(id);

  // 获取节点尺寸，使用 useMemo 确保尺寸变化时重新计算
  const node = flowGraph.getNodeById(id);
  const hasFixedSize = useMemo(() => {
    const nodeWidth = node?.width ?? node?.style?.width;
    const nodeHeight = node?.height ?? node?.style?.height;
    // 只有当 width 和 height 都存在且都是正数时，才认为有固定尺寸
    return typeof nodeWidth === 'number' && typeof nodeHeight === 'number' && nodeWidth > 0 && nodeHeight > 0;
  }, [node?.width, node?.height, node?.style?.width, node?.style?.height]);

  const handleUploadFile = useCallback(async (file: File) => {
    const res = await uploadFile(file, 'flowcanvas');
    return res;
  }, []);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert(t('selectAudioFile'));
      return;
    }

    setIsUploading(true);

    try {
      const key = await handleUploadFile(file);
      flowGraph.updateNodeData(id, { output: { audios: { list: [key, ...(data.output?.audios?.list || [])], selected: key } } });
    } catch (error) {
      console.error('Audio upload failed:', error);
      alert(t('audioUploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  // 处理actionData变化
  const handleActionDataChange = useCallback<NonNullable<AudioNodeTooltipProps['onValueChange']>>(
    (newActionData: any) => {
      flowGraph.updateNodeData(id, { actionData: newActionData });
    },
    [flowGraph, id],
  );

  // 处理tooltip提交
  const handleTooltipSubmit = useCallback<NonNullable<AudioNodeTooltipProps['onSubmitSuccess']>>(
    (output: any) => {
      flowGraph.updateNodeData(id, { output });
    },
    [flowGraph, id],
  );

  return (
    <>
      <BaseNode
        data={data}
        id={id}
        resizeConfig={{ enabled: true, minWidth: 300, minHeight: 100, maxWidth: 600, maxHeight: 200 }}
        tooltip={
          <AudioNodeTooltip nodeId={id} value={data.actionData} onValueChange={handleActionDataChange} onSubmitSuccess={handleTooltipSubmit} />
        }
        className="w-100"
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

        {data.output?.audios?.selected ? (
          <div
            className={cn('bg-muted flex items-center justify-center rounded p-4', hasFixedSize ? 'h-full w-full' : 'w-full')}
            style={hasFixedSize ? { width: '100%', height: '100%', minWidth: 0, maxWidth: '100%' } : undefined}
          >
            <AudioPlayer src={`/api/oss/${data.output?.audios?.selected}`} className={cn('w-full', hasFixedSize ? 'max-w-full' : 'max-w-[300px]')} />
          </div>
        ) : (
          <div
            className={cn(
              'bg-muted flex items-center justify-center rounded p-2 text-center transition-colors',
              hasFixedSize ? 'h-full w-full' : 'h-fit w-fit',
            )}
            style={hasFixedSize ? { width: '100%', height: '100%' } : undefined}
          >
            {isUploading ? (
              <div className="text-chart-2 flex flex-col items-center">
                <div className="border-border-primary border-t-chart-2 mb-2 h-5 w-5 animate-spin rounded-full border-2"></div>
                <span>{t('uploading')}</span>
              </div>
            ) : (
              <div className="flex h-32 flex-col justify-center gap-1 space-y-1 p-4 text-sm">
                <div className="cursor-pointer text-left" onClick={handleFileSelect}>
                  1. {t('uploadAudio')}
                </div>
                <div className="text-muted-foreground text-left" onClick={() => {}}>
                  2. {t('generateAudio')}
                </div>
              </div>
            )}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileChange} style={{ display: 'none' }} />
      </BaseNode>
    </>
  );
}
