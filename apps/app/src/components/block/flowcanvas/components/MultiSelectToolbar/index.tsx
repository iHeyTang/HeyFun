import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useStore, ViewportPortal } from '@xyflow/react';
import { PlayIcon, ExpandIcon, GroupIcon, LayoutIcon, LayoutGridIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFlowGraph } from '../../hooks/useFlowGraph';
import type { FlowGraphNode } from '../../types/nodes';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  /** 打组选中节点的回调 */
  onGroupSelectedNodes?: (selectedNodes: string[]) => void;
  /** 拆组选中节点的回调 */
  onUngroupSelectedNode?: (groupNodeId: string) => void;
  /** 布局 group 的回调 */
  onLayoutGroup?: (groupNodeId: string, direction: 'TB' | 'LR') => void;
}

export const MultiSelectToolbar = ({
  selecting,
  selectedNodes,
  className,
  onExecuteSelectedNodes,
  onGroupSelectedNodes,
  onUngroupSelectedNode,
  onLayoutGroup,
}: MultiSelectToolbarProps) => {
  const flowGraph = useFlowGraph();
  const t = useTranslations();

  const toolbarRef = useRef<HTMLDivElement>(null);

  // 布局方向状态：每次点击切换 LR -> TB -> LR ...
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('LR');

  // 检查选中的节点是否是单个组节点
  const selectedGroupNode = useMemo(() => {
    if (selectedNodes.length === 1) {
      const nodeId = selectedNodes[0];
      if (nodeId) {
        const node = flowGraph.reactFlowInstance.getNode(nodeId) as FlowGraphNode | undefined;
        if (node?.type === 'group') {
          return nodeId;
        }
      }
    }
    return null;
  }, [selectedNodes, flowGraph.reactFlowInstance]);

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
    if (selectedNodes.length >= 1) {
      return flowGraph.reactFlowInstance.getNodesBounds(selectedNodes);
    }
    return { x: 0, y: 0, width: 0, height: 0 };
  }, [selectedNodes, flowGraph.reactFlowInstance, nodePositions]);

  // 更新工具栏位置
  const updatePosition = useCallback(() => {
    if (selectedNodes.length >= 1 && toolbarRef.current) {
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

  // 打组选中的节点
  const handleGroupSelectedNodes = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    console.log('handleGroupSelectedNodes 被调用', { event, selectedNodes });
    event.stopPropagation();

    if (selectedNodes.length < 2) {
      console.log('至少需要选择2个节点才能打组');
      return;
    }

    console.log('开始打组选中的节点:', selectedNodes);

    try {
      if (onGroupSelectedNodes) {
        onGroupSelectedNodes(selectedNodes);
      }
      console.log('节点打组完成');
    } catch (error) {
      console.error('打组选中节点时出错:', error);
    }
  };

  // 拆组选中的节点
  const handleUngroupSelectedNode = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    console.log('handleUngroupSelectedNode 被调用', { event, selectedGroupNode });
    event.stopPropagation();

    if (!selectedGroupNode) {
      console.log('没有选中组节点');
      return;
    }

    console.log('开始拆组选中的节点:', selectedGroupNode);

    try {
      if (onUngroupSelectedNode) {
        onUngroupSelectedNode(selectedGroupNode);
      }
      console.log('节点拆组完成');
    } catch (error) {
      console.error('拆组选中节点时出错:', error);
    }
  };

  // 布局选中的 group（每次点击切换方向）
  const handleLayoutGroup = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    console.log('handleLayoutGroup 被调用', { event, selectedGroupNode, currentDirection: layoutDirection });
    event.stopPropagation();

    if (!selectedGroupNode) {
      console.log('没有选中组节点');
      return;
    }

    console.log('开始布局组节点:', selectedGroupNode, '方向:', layoutDirection);

    try {
      if (onLayoutGroup) {
        onLayoutGroup(selectedGroupNode, layoutDirection);
      }

      // 切换方向：LR -> TB -> LR ...
      setLayoutDirection(prev => (prev === 'LR' ? 'TB' : 'LR'));

      console.log('组节点布局完成，下次方向:', layoutDirection === 'LR' ? 'TB' : 'LR');
    } catch (error) {
      console.error('布局组节点时出错:', error);
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
        style={{ width: bounds.width, zIndex: 9999, pointerEvents: 'auto', top: selectedGroupNode ? -40 : 0 }}
      >
        {selectedNodes.length >= 1 && !selecting && (
          <div
            className={cn('flex gap-2', className)}
            style={{ pointerEvents: 'auto' }}
            onClick={e => {
              console.log('工具栏容器被点击', e);
              e.stopPropagation();
            }}
          >
            {selectedGroupNode ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleLayoutGroup} style={{ pointerEvents: 'auto' }} type="button" variant="outline">
                    <LayoutGridIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t('flowcanvas.project.autoLayout')} (
                  {layoutDirection === 'LR' ? t('flowcanvas.toolbar.horizontal') : t('flowcanvas.toolbar.vertical')})
                </TooltipContent>
              </Tooltip>
            ) : null}

            {/* 执行按钮 - 多选或选中组节点时显示 */}
            {selectedNodes.length > 1 || selectedGroupNode ? (
              <Button
                onClick={handleExecuteSelectedNodes}
                style={{ pointerEvents: 'auto' }}
                title={t('flowcanvas.toolbar.executeSelected')}
                type="button"
              >
                <PlayIcon className="h-4 w-4" />
                {t('flowcanvas.toolbar.execute')}
              </Button>
            ) : null}

            {/* 如果选中单个组节点，显示布局和拆组按钮 */}
            {selectedGroupNode ? (
              <>
                <Button
                  onClick={handleUngroupSelectedNode}
                  style={{ pointerEvents: 'auto' }}
                  title={t('flowcanvas.toolbar.ungroupSelected')}
                  type="button"
                  variant="outline"
                >
                  <ExpandIcon className="h-4 w-4" />
                  {t('flowcanvas.toolbar.ungroup')}
                </Button>
              </>
            ) : (
              <>
                {/* 打组按钮（只有多选时显示） */}
                {selectedNodes.length > 1 && (
                  <Button
                    onClick={handleGroupSelectedNodes}
                    style={{ pointerEvents: 'auto' }}
                    title={t('flowcanvas.toolbar.groupSelected')}
                    type="button"
                    variant="outline"
                  >
                    <GroupIcon className="h-4 w-4" />
                    {t('flowcanvas.toolbar.group')}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </ViewportPortal>
  );
};

MultiSelectToolbar.displayName = 'MultiSelectToolbar';

export default MultiSelectToolbar;
