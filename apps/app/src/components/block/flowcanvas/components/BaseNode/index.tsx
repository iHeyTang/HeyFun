import { cn } from '@/lib/utils';
import { Handle, Position, useViewport } from '@xyflow/react';
import { useCallback, useRef, useState } from 'react';
import { useFlowGraphContext, useNodeStatusById } from '../../FlowCanvasProvider';
import { useFlowGraph } from '../../hooks';
import { NodeData, NodeStatus } from '../../types/nodes';
import { NodeTooltip, NodeTooltipContent, NodeTooltipTrigger } from '../NodeTooltip';

interface BaseNodeProps {
  data: NodeData;
  id: string; // 添加nodeId prop
  children?: React.ReactNode;
  className?: string;
  showHandles?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onBlur?: () => void;
  tooltip?: React.ReactNode;
}

export default function BaseNode({ data, id, children, className = '', showHandles = true, onDragStart, onDragEnd, tooltip, onBlur }: BaseNodeProps) {
  const flowGraph = useFlowGraph();
  const { focusedNodeId } = useFlowGraphContext();
  const { zoom } = useViewport(); // 获取当前画布缩放比例
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragThreshold = 5; // 拖动阈值，超过这个距离才算拖动

  // 可编辑标签的状态
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabelValue, setEditLabelValue] = useState(data.label);

  // 标签编辑相关函数
  const handleLabelClick = useCallback(() => {
    setIsEditingLabel(true);
    setEditLabelValue(data.label);
  }, [data.label]);

  const handleLabelSave = useCallback(() => {
    if (editLabelValue.trim() && editLabelValue !== data.label) {
      flowGraph.updateNodeData(id, { label: editLabelValue.trim() });
    }
    setIsEditingLabel(false);
  }, [editLabelValue, data.label, flowGraph, id]);

  const handleLabelCancel = useCallback(() => {
    setEditLabelValue(data.label);
    setIsEditingLabel(false);
  }, [data.label]);

  const handleLabelKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleLabelSave();
      } else if (event.key === 'Escape') {
        handleLabelCancel();
      }
    },
    [handleLabelSave, handleLabelCancel],
  );

  const node = flowGraph.getNodeById(id);
  const selected = node?.selected;

  // 使用Context获取节点状态
  const { status, statusData } = useNodeStatusById(id);

  // 获取节点状态对应的样式
  const getStatusStyle = (status?: NodeStatus) => {
    switch (status) {
      case NodeStatus.PROCESSING:
        return 'border-chart-2';
      case NodeStatus.COMPLETED:
        return 'border-success';
      case NodeStatus.FAILED:
        return 'border-destructive';
      case NodeStatus.PENDING:
        return 'border-chart-4';
      case NodeStatus.PAUSED:
        return 'border-border-secondary';
      default:
        return 'border-border-primary';
    }
  };

  // 获取状态指示器
  const getStatusIndicator = (status?: NodeStatus) => {
    switch (status) {
      case NodeStatus.PROCESSING:
        return <div className="bg-chart-2 h-3 w-3 animate-pulse rounded-full" />;
      case NodeStatus.COMPLETED:
        return <div className="bg-success h-3 w-3 rounded-full" />;
      case NodeStatus.FAILED:
        return (
          <div>
            <div className="bg-destructive h-3 w-3 rounded-full" />
            {statusData?.error}
          </div>
        );
      case NodeStatus.PENDING:
        return <div className="bg-chart-4 h-3 w-3 rounded-full" />;
      case NodeStatus.PAUSED:
        return <div className="bg-secondary h-3 w-3 rounded-full" />;
      default:
        return <div className="bg-secondary h-3 w-3 rounded-full" />;
    }
  };

  // 处理鼠标按下事件
  const handleMouseDown = (event: React.MouseEvent) => {
    // 检查是否点击在nodrag元素上
    const target = event.target as HTMLElement;
    if (target.closest('.nodrag')) {
      return;
    }

    dragStartPos.current = { x: event.clientX, y: event.clientY };
    setIsDragging(false);
  };

  // 处理鼠标移动事件
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!dragStartPos.current) return;

    const deltaX = Math.abs(event.clientX - dragStartPos.current.x);
    const deltaY = Math.abs(event.clientY - dragStartPos.current.y);

    if (deltaX > dragThreshold || deltaY > dragThreshold) {
      if (!isDragging) {
        setIsDragging(true);
        onDragStart?.();
      }
    }
  };

  // 处理鼠标抬起事件
  const handleMouseUp = () => {
    if (isDragging) {
      onDragEnd?.();
    }
    dragStartPos.current = null;
    setIsDragging(false);
  };

  // 转换字符串位置为Position枚举
  const getPosition = (pos: Position | string): Position => {
    if (typeof pos === 'string') {
      switch (pos) {
        case 'left':
          return Position.Left;
        case 'right':
          return Position.Right;
        case 'top':
          return Position.Top;
        case 'bottom':
          return Position.Bottom;
        default:
          return Position.Top;
      }
    }
    return pos;
  };

  const hoverHandleSize = 60; // hover时的基准大小（px）
  const handleHoverSize = hoverHandleSize / zoom;
  return (
    <NodeTooltip>
      {tooltip && (
        <NodeTooltipContent position={Position.Bottom} isVisible={focusedNodeId === id}>
          {tooltip}
        </NodeTooltipContent>
      )}
      <NodeTooltipTrigger>
        <div
          className={cn('relative')}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onBlur={onBlur}
        >
          {/* 标题和状态在卡片外部左上角 */}
          <div className="mb-1 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              {getStatusIndicator(status)}
              {isEditingLabel ? (
                <input
                  type="text"
                  value={editLabelValue}
                  onChange={e => setEditLabelValue(e.target.value)}
                  onBlur={handleLabelSave}
                  onKeyDown={handleLabelKeyDown}
                  className="min-w-0 flex-1 rounded border-none bg-transparent px-1 py-0.5 text-xs outline-none"
                  style={{ width: `${Math.max(editLabelValue.length * 8, 60)}px` }}
                  autoFocus
                />
              ) : (
                <span
                  className="hover:bg-accent hover:text-accent-foreground text-foreground cursor-pointer rounded px-1 py-0.5 transition-colors"
                  onClick={handleLabelClick}
                >
                  {data.label}
                </span>
              )}
            </div>
          </div>

          {/* 卡片主体 */}
          <div className={cn('group relative transition-all duration-200', isDragging ? 'cursor-grabbing' : 'cursor-grab')}>
            {/* 渲染输入端口 */}
            {showHandles && (
              <Handle
                type="target"
                position={getPosition(Position.Left)}
                id="input"
                className={cn('z-100 origin-top-left transition-all duration-200', '-left-[12px]!')}
                style={{
                  // @ts-expect-error: React Flow Handle 样式
                  '--handle-hover-size': `${handleHoverSize}px`,
                }}
                onConnect={params => console.log('handle onConnect', params)}
                isConnectable={true}
              />
            )}
            <div
              className={cn(
                'bg-card max-w-120 rounded-sm p-1 shadow-sm',
                getStatusStyle(status),
                focusedNodeId === id ? 'border-primary' : selected ? 'border-chart-1' : '',
                className,
              )}
            >
              {children}
            </div>

            {/* 渲染输出端口 */}
            {showHandles && (
              <Handle
                type="source"
                position={getPosition(Position.Right)}
                id="output"
                className={cn('z-100 origin-top-right transition-all duration-200', '-right-[12px]!')}
                style={{
                  // @ts-expect-error: React Flow Handle 样式
                  '--handle-hover-size': `${handleHoverSize}px`,
                }}
                onConnect={params => console.log('handle onConnect', params)}
                isConnectable={true}
              />
            )}
          </div>
        </div>
      </NodeTooltipTrigger>
    </NodeTooltip>
  );
}
