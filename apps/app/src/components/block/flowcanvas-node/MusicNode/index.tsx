import { AudioPlayer } from '@/components/block/audio-player';
import { BaseNode, NodeData, NodeStatus, useFlowGraph, useNodeStatusById } from '@/components/block/flowcanvas';
import { Loader2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { MusicNodeActionData } from './processor';
import { MusicNodeTooltip, MusicNodeTooltipProps } from './tooltip';
import { cn } from '@/lib/utils';

interface MusicNodeProps {
  data: NodeData<MusicNodeActionData>;
  id: string;
}

export { MusicNodeProcessor } from './processor';

export default function MusicNode({ data, id }: MusicNodeProps) {
  const flowGraph = useFlowGraph();
  const status = useNodeStatusById(id);

  // 获取节点尺寸，使用 useMemo 确保尺寸变化时重新计算
  const node = flowGraph.getNodeById(id);
  const hasFixedSize = useMemo(() => {
    const nodeWidth = node?.width ?? node?.style?.width;
    const nodeHeight = node?.height ?? node?.style?.height;
    // 只有当 width 和 height 都存在且都是正数时，才认为有固定尺寸
    return typeof nodeWidth === 'number' && typeof nodeHeight === 'number' && nodeWidth > 0 && nodeHeight > 0;
  }, [node?.width, node?.height, node?.style?.width, node?.style?.height]);

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
      resizeConfig={{ enabled: true, minWidth: 300, minHeight: 100, maxWidth: 600, maxHeight: 200 }}
      tooltip={<MusicNodeTooltip nodeId={id} value={data.actionData} onValueChange={handleActionDataChange} onSubmitSuccess={handleTooltipSubmit} />}
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

      {data.output?.musics?.selected ? (
        <div
          className={cn('bg-muted flex items-center justify-center rounded p-4', hasFixedSize ? 'h-full w-full' : 'w-full')}
          style={hasFixedSize ? { width: '100%', height: '100%', minWidth: 0, maxWidth: '100%' } : undefined}
        >
          <AudioPlayer src={`/api/oss/${data.output?.musics?.selected}`} className={cn('w-full', hasFixedSize ? 'max-w-full' : 'max-w-[300px]')} />
        </div>
      ) : (
        <div
          className={cn(
            'bg-muted flex items-center justify-center rounded p-2 text-center transition-colors',
            hasFixedSize ? 'h-full w-full' : 'h-fit w-fit',
          )}
          style={hasFixedSize ? { width: '100%', height: '100%' } : undefined}
        >
          <div className="flex h-32 flex-col justify-center gap-1 space-y-1 p-4 text-sm">
            <div className="text-muted-foreground text-left">Enter lyrics and prompt below to generate music</div>
          </div>
        </div>
      )}
    </BaseNode>
  );
}
