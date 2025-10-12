import { AudioPlayer } from '@/components/block/audio-player';
import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { uploadFile } from '@/lib/browser/file';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioNodeActionData } from './processor';
import { AudioNodeTooltip, AudioNodeTooltipProps } from './tooltip';
import { useTranslations } from 'next-intl';

interface AudioNodeProps {
  data: NodeData<AudioNodeActionData>;
  id: string;
}

export { AudioNodeProcessor } from './processor';

export default function AudioNode({ data, id }: AudioNodeProps) {
  const t = useTranslations('flowcanvas.nodes');

  const flowGraph = useFlowGraph();
  const [isUploading, setIsUploading] = useState(false);
  const [audioKey, setAudioKey] = useState<string | undefined>(data.output?.audios?.[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = useNodeStatusById(id);

  const handleUploadFile = useCallback(async (file: File) => {
    const res = await uploadFile(file, 'flowcanvas');
    return res;
  }, []);

  // 监听data.output变化，强制更新组件状态
  useEffect(() => {
    const newAudioKey = data.output?.audios?.[0];
    if (newAudioKey !== audioKey) {
      console.log(`AudioNode ${id} - 检测到输出数据变化:`, {
        oldKey: audioKey,
        newKey: newAudioKey,
        fullOutput: data.output,
        timestamp: new Date().toISOString(),
      });
      setAudioKey(newAudioKey);
    }
  }, [data.output, data.output?.audios, id, audioKey, data]);

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
      flowGraph.updateNodeData(id, { output: { audios: [key] } });
    } catch (error) {
      console.error('Audio upload failed:', error);
      alert(t('audioUploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  // 处理actionData变化
  const handleActionDataChange = useCallback<NonNullable<AudioNodeTooltipProps['onValueChange']>>((newActionData: any) => {
    flowGraph.updateNodeData(id, { actionData: newActionData });
  }, []);

  // 处理tooltip提交
  const handleTooltipSubmit = useCallback<NonNullable<AudioNodeTooltipProps['onSubmitSuccess']>>((output: any) => {
    flowGraph.updateNodeData(id, { output });
  }, []);

  return (
    <>
      <BaseNode
        data={data}
        id={id}
        tooltip={
          <AudioNodeTooltip nodeId={id} value={data.actionData} onValueChange={handleActionDataChange} onSubmitSuccess={handleTooltipSubmit} />
        }
        className="w-100"
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

          {audioKey ? (
            <div className="bg-muted flex w-full items-center justify-center rounded p-4">
              <AudioPlayer src={`/api/oss/${audioKey}`} className="w-full max-w-[300px]" />
            </div>
          ) : (
            <div className="bg-muted flex items-center justify-center rounded p-2 text-center transition-colors">
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
        </div>
      </BaseNode>
    </>
  );
}
