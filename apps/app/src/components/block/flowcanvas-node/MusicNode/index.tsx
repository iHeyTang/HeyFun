import { getSignedUrl } from '@/actions/oss';
import { AudioPlayer } from '@/components/block/audio-player';
import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { MusicNodeActionData } from './processor';
import { MusicNodeTooltip, MusicNodeTooltipProps } from './tooltip';

interface MusicNodeProps {
  data: NodeData<MusicNodeActionData>;
  id: string;
}

export { MusicNodeProcessor } from './processor';

export default function MusicNode({ data, id }: MusicNodeProps) {
  const flowGraph = useFlowGraph();
  const [musicUrl, setMusicUrl] = useState<string | undefined>();
  const [musicKey, setMusicKey] = useState<string | undefined>(data.output?.musics?.[0]?.key);
  const status = useNodeStatusById(id);

  const [isMusicLoading, setIsMusicLoading] = useState(false);

  // 监听data.output变化，强制更新组件状态
  useEffect(() => {
    console.log('data.output', data.output?.musics);
    const newMusicKey = data.output?.musics?.[0]?.key;
    if (newMusicKey !== musicKey) {
      console.log(`MusicNode ${id} - 检测到输出数据变化:`, {
        oldKey: musicKey,
        newKey: newMusicKey,
        fullOutput: data.output,
        timestamp: new Date().toISOString(),
      });
      setMusicKey(newMusicKey);
    }
  }, [data.output, data.output?.musics, id, musicKey, data]);

  // 将key转换为URL进行展示
  useEffect(() => {
    if (musicKey) {
      setIsMusicLoading(true);
      getSignedUrl({ fileKey: musicKey })
        .then(result => {
          if (result.data) {
            setMusicUrl(result.data);
          }
        })
        .catch(error => {
          console.error('Failed to get signed URL:', error);
        })
        .finally(() => {
          setIsMusicLoading(false);
        });
    } else {
      setMusicUrl(undefined);
      setIsMusicLoading(false);
    }
  }, [musicKey]);

  // 处理actionData变化
  const handleActionDataChange = useCallback<NonNullable<MusicNodeTooltipProps['onValueChange']>>((newActionData: any) => {
    flowGraph.updateNodeData(id, { actionData: newActionData });
  }, []);

  // 处理tooltip提交
  const handleTooltipSubmit = useCallback<NonNullable<MusicNodeTooltipProps['onSubmitSuccess']>>((output: any) => {
    flowGraph.updateNodeData(id, { output });
  }, []);

  return (
    <BaseNode
      data={data}
      id={id}
      tooltip={<MusicNodeTooltip nodeId={id} value={data.actionData} onValueChange={handleActionDataChange} onSubmitSuccess={handleTooltipSubmit} />}
      className="w-100"
    >
      <div className="relative">
        {(status.status === NodeStatus.PROCESSING || isMusicLoading) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded">
            {/* 高斯模糊蒙版 */}
            <div className="bg-accent/20 absolute inset-0 rounded backdrop-blur-lg"></div>
            {/* Loading动画 */}
            <div className="relative z-10 flex flex-col items-center justify-center">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
            </div>
          </div>
        )}

        {musicUrl ? (
          <div className="bg-muted flex w-full items-center justify-center rounded p-4">
            <AudioPlayer src={musicUrl} className="w-full max-w-[300px]" onLoadedData={() => setIsMusicLoading(false)} />
          </div>
        ) : (
          <div className="bg-muted flex items-center justify-center rounded p-2 text-center transition-colors">
            <div className="flex h-32 flex-col justify-center gap-1 space-y-1 p-4 text-sm">
              <div className="text-muted-foreground text-left">Enter lyrics and prompt below to generate music</div>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
