import { AudioPlayer } from '@/components/block/audio-player';
import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { Loader2 } from 'lucide-react';
import { useCallback } from 'react';
import { MusicNodeActionData } from './processor';
import { MusicNodeTooltip, MusicNodeTooltipProps } from './tooltip';

interface MusicNodeProps {
  data: NodeData<MusicNodeActionData>;
  id: string;
}

export { MusicNodeProcessor } from './processor';

export default function MusicNode({ data, id }: MusicNodeProps) {
  const flowGraph = useFlowGraph();
  const status = useNodeStatusById(id);

  // 处理actionData变化
  const handleActionDataChange = useCallback<NonNullable<MusicNodeTooltipProps['onValueChange']>>(
    (newActionData: any) => {
      flowGraph.updateNodeData(id, { actionData: newActionData });
    },
    [flowGraph, id],
  );

  // 处理tooltip提交
  const handleTooltipSubmit = useCallback<NonNullable<MusicNodeTooltipProps['onSubmitSuccess']>>(
    (output: any) => {
      flowGraph.updateNodeData(id, { output });
    },
    [flowGraph, id],
  );

  return (
    <BaseNode
      data={data}
      id={id}
      tooltip={<MusicNodeTooltip nodeId={id} value={data.actionData} onValueChange={handleActionDataChange} onSubmitSuccess={handleTooltipSubmit} />}
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

        {data.output?.musics?.selected ? (
          <div className="bg-muted flex w-full items-center justify-center rounded p-4">
            <AudioPlayer src={`/api/oss/${data.output?.musics?.selected}`} className="w-full max-w-[300px]" />
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
