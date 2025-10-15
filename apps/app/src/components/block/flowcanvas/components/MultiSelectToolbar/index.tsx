import { cn } from '@/lib/utils';
import { useStore, ViewportPortal } from '@xyflow/react';
import { useFlowGraph } from '../../hooks/useFlowGraph';
import { PlayIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { FlowGraphNode } from '../../types/nodes';
import { Button } from '@/components/ui/button';

export { useMultiSelectToolbar } from './hooks/useMultiSelectToolbar';
export type { MultiSelectToolbarExtensionContext, MultiSelectToolbarExtensionResult } from './hooks/useMultiSelectToolbar';

export interface MultiSelectToolbarProps {
  /** 是否正在选择状态 */
  selecting: boolean;
  /** 选中的节点 */
  selectedNodes: string[];
  /** 额外的CSS类名 */
  className?: string;
  /** 执行选中节点的回调 */
  onExecuteSelectedNodes?: (selectedNodes: string[]) => Promise<void>;
}

export const MultiSelectToolbar = ({ selecting, selectedNodes, className, onExecuteSelectedNodes }: MultiSelectToolbarProps) => {
  const flowGraph = useFlowGraph();
  const t = useTranslations('flowcanvas.toolbar');

  const toolbarRef = useRef<HTMLDivElement>(null);

  // 监听节点位置变化，用于实时更新工具栏位置
  const nodePositions = useStore(
    useCallback(
      store => {
        const positions: Record<string, { x: number; y: number }> = {};
        selectedNodes.forEach(nodeId => {
          const node = store.nodeLookup.get(nodeId) as FlowGraphNode | undefined;
          if (node) {
            positions[nodeId] = { x: node.position.x, y: node.position.y };
          }
        });
        return positions;
      },
      [selectedNodes],
    ),
  );

  // 计算选中节点的边界
  const bounds = useMemo(() => {
    if (selectedNodes.length > 1) {
      return flowGraph.reactFlowInstance.getNodesBounds(selectedNodes);
    }
    return { x: 0, y: 0, width: 0, height: 0 };
  }, [selectedNodes, flowGraph.reactFlowInstance, nodePositions]);

  // 更新工具栏位置
  const updatePosition = useCallback(() => {
    if (selectedNodes.length > 1 && toolbarRef.current) {
      const newBounds = flowGraph.reactFlowInstance.getNodesBounds(selectedNodes);
      toolbarRef.current.style.transform = `translate(${newBounds.x}px, ${newBounds.y - 60}px)`;
    }
  }, [selectedNodes, flowGraph.reactFlowInstance]);

  // 执行选中的节点
  const handleExecuteSelectedNodes = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    console.log('handleExecuteSelectedNodes 被调用', { event, selectedNodes });
    event.stopPropagation();

    if (selectedNodes.length === 0) {
      console.log('没有选中的节点，跳过执行');
      return;
    }

    console.log('开始执行选中的节点:', selectedNodes);

    try {
      if (onExecuteSelectedNodes) {
        // 使用外部提供的执行回调
        await onExecuteSelectedNodes(selectedNodes);
      }
      console.log('所有选中节点执行完成');
    } catch (error) {
      console.error('执行选中节点时出错:', error);
    }
  };

  // 当选中节点或节点位置变化时更新工具栏位置
  useEffect(() => {
    updatePosition();
  }, [updatePosition, nodePositions]);

  return (
    <ViewportPortal>
      <div
        ref={toolbarRef}
        className="absolute flex justify-center"
        style={{
          width: bounds.width,
          zIndex: 9999,
          pointerEvents: 'auto',
        }}
      >
        {selectedNodes.length > 1 && !selecting && (
          <div
            className={cn('', className)}
            style={{ pointerEvents: 'auto' }}
            onClick={e => {
              console.log('工具栏容器被点击', e);
              e.stopPropagation();
            }}
          >
            {/* 执行按钮 */}
            <Button onClick={handleExecuteSelectedNodes} style={{ pointerEvents: 'auto' }} title={t('executeSelected')} type="button">
              <PlayIcon className="h-4 w-4" />
              {t('execute')}
            </Button>
          </div>
        )}
      </div>
    </ViewportPortal>
  );
};

MultiSelectToolbar.displayName = 'MultiSelectToolbar';

export default MultiSelectToolbar;
