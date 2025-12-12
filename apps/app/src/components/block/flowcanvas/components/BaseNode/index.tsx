import { cn } from '@/lib/utils';
import { Handle, NodeResizer, Position, useViewport } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFlowGraphContext, useNodeStatusById } from '../../FlowCanvasProvider';
import { useFlowGraph } from '../../hooks';
import { NodeData, NodeStatus } from '../../types/nodes';
import { NodeTooltip, NodeTooltipContent, NodeTooltipTrigger } from '../NodeTooltip';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * 调整大小模式
 */
export type ResizeMode = 'free' | 'aspectRatio';

/**
 * 调整大小配置
 */
export interface ResizeConfig {
  /** 是否允许调整大小 */
  enabled?: boolean;
  /** 调整模式：'free' 自由调整，'aspectRatio' 保持宽高比 */
  mode?: ResizeMode;
  /** 最小宽度 */
  minWidth?: number;
  /** 最小高度 */
  minHeight?: number;
  /** 最大宽度 */
  maxWidth?: number;
  /** 最大高度 */
  maxHeight?: number;
  /** 宽高比（仅在 mode 为 'aspectRatio' 时有效） */
  aspectRatio?: number;
}

interface BaseNodeProps {
  id: string; // 添加nodeId prop
  data: NodeData;
  children?: React.ReactNode;
  className?: string;
  showHandles?: boolean;
  toolbar?: React.ReactNode;
  tooltip?: React.ReactNode;
  onBlur?: (event: React.FocusEvent) => void;
  ref?: React.ForwardedRef<HTMLDivElement>;
  /** 调整大小配置 */
  resizeConfig?: ResizeConfig;
}

export default function BaseNode({
  data,
  id,
  children,
  className = '',
  showHandles = true,
  toolbar,
  tooltip,
  onBlur,
  ref,
  resizeConfig,
}: BaseNodeProps) {
  const flowGraph = useFlowGraph();
  const { focusedNodeId } = useFlowGraphContext();
  const { zoom } = useViewport(); // 获取当前画布缩放比例

  // 可编辑标签的状态
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabelValue, setEditLabelValue] = useState(data.label);

  // 调整大小配置的默认值
  const resizeEnabled = resizeConfig?.enabled ?? false;
  const resizeMode = resizeConfig?.mode ?? 'free';
  const minWidth = resizeConfig?.minWidth ?? 50;
  const minHeight = resizeConfig?.minHeight ?? 50;
  const maxWidth = resizeConfig?.maxWidth;
  const maxHeight = resizeConfig?.maxHeight;
  const aspectRatio = resizeConfig?.aspectRatio;

  // 获取当前节点
  const node = flowGraph.getNodeById(id);
  const selected = node?.selected;

  // 计算初始宽高比（如果未指定且模式为比例调整）
  const initialAspectRatio = useRef<number | null>(null);
  const lastSize = useRef<{ width: number; height: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  // 使用 useEffect 初始化 ref，避免在渲染期间访问
  useEffect(() => {
    if (initialAspectRatio.current === null && node) {
      const nodeWidth = node.width || node.style?.width || 200;
      const nodeHeight = node.height || node.style?.height || 100;
      if (typeof nodeWidth === 'number' && typeof nodeHeight === 'number' && nodeHeight > 0) {
        initialAspectRatio.current = nodeWidth / nodeHeight;
        lastSize.current = { width: nodeWidth, height: nodeHeight };
      } else {
        initialAspectRatio.current = aspectRatio || 1;
        lastSize.current = { width: 200, height: 200 / (aspectRatio || 1) };
      }
    }
  }, [node, aspectRatio]);

  // 处理调整大小开始
  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
  }, []);

  // 处理调整大小（实时更新，但不频繁更新节点状态）
  const handleResize = useCallback(
    (_event: any, params: { width: number; height: number }) => {
      if (!resizeEnabled) return;

      let { width, height } = params;

      // 如果是比例调整模式
      if (resizeMode === 'aspectRatio') {
        const ratio = aspectRatio || initialAspectRatio.current || 1;
        const last = lastSize.current || { width: width, height: height };

        // 判断用户主要调整的是宽度还是高度（通过比较变化量）
        const widthDelta = Math.abs(width - last.width);
        const heightDelta = Math.abs(height - last.height);

        if (widthDelta > heightDelta) {
          // 主要调整宽度，根据宽度计算高度
          height = width / ratio;
          // 检查高度限制
          if (height < minHeight) {
            height = minHeight;
            width = height * ratio;
          } else if (maxHeight && height > maxHeight) {
            height = maxHeight;
            width = height * ratio;
          }
          // 检查宽度限制
          if (width < minWidth) {
            width = minWidth;
            height = width / ratio;
          } else if (maxWidth && width > maxWidth) {
            width = maxWidth;
            height = width / ratio;
          }
        } else {
          // 主要调整高度，根据高度计算宽度
          width = height * ratio;
          // 检查宽度限制
          if (width < minWidth) {
            width = minWidth;
            height = width / ratio;
          } else if (maxWidth && width > maxWidth) {
            width = maxWidth;
            height = width / ratio;
          }
          // 检查高度限制
          if (height < minHeight) {
            height = minHeight;
            width = height * ratio;
          } else if (maxHeight && height > maxHeight) {
            height = maxHeight;
            width = height * ratio;
          }
        }

        // 更新最后的大小
        lastSize.current = { width, height };
      } else {
        // 自由调整模式，只应用最小/最大限制
        width = Math.max(minWidth, width);
        height = Math.max(minHeight, height);
        if (maxWidth) width = Math.min(maxWidth, width);
        if (maxHeight) height = Math.min(maxHeight, height);
      }

      // 在调整大小过程中，只更新尺寸用于视觉反馈
      // NodeResizer 会自动处理视觉更新，我们只需要在结束时更新节点状态
      lastSize.current = { width, height };
    },
    [resizeEnabled, resizeMode, minWidth, minHeight, maxWidth, maxHeight, aspectRatio, initialAspectRatio],
  );

  // 处理调整大小结束（最终更新节点尺寸）
  const handleResizeEnd = useCallback(
    (_event: any, params: { width: number; height: number }) => {
      if (!resizeEnabled) return;

      let { width, height } = params;

      // 应用最小/最大限制
      width = Math.max(minWidth, width);
      height = Math.max(minHeight, height);
      if (maxWidth) width = Math.min(maxWidth, width);
      if (maxHeight) height = Math.min(maxHeight, height);

      // 如果是比例调整模式，确保保持比例
      if (resizeMode === 'aspectRatio') {
        const ratio = aspectRatio || initialAspectRatio.current || 1;
        const widthByHeight = height * ratio;
        const heightByWidth = width / ratio;

        // 选择更合适的尺寸
        if (Math.abs(width - widthByHeight) < Math.abs(height - heightByWidth)) {
          width = widthByHeight;
        } else {
          height = heightByWidth;
        }

        // 再次应用限制
        if (width < minWidth) {
          width = minWidth;
          height = width / ratio;
        } else if (maxWidth && width > maxWidth) {
          width = maxWidth;
          height = width / ratio;
        }
        if (height < minHeight) {
          height = minHeight;
          width = height * ratio;
        } else if (maxHeight && height > maxHeight) {
          height = maxHeight;
          width = height * ratio;
        }
      }

      // 最终更新节点尺寸
      flowGraph.reactFlowInstance.setNodes(nodes =>
        nodes.map(n => {
          if (n.id === id) {
            return {
              ...n,
              width,
              height,
              style: {
                ...n.style,
                width,
                height,
              },
            };
          }
          return n;
        }),
      );

      lastSize.current = { width, height };
      setIsResizing(false);
    },
    [resizeEnabled, resizeMode, minWidth, minHeight, maxWidth, maxHeight, aspectRatio, initialAspectRatio, flowGraph, id],
  );

  // 标签编辑相关函数
  const handleLabelClick = useCallback(() => {
    setIsEditingLabel(true);
    setEditLabelValue(data.label);
  }, [data.label]);

  const handleLabelSave = useCallback(() => {
    if (editLabelValue?.trim() && editLabelValue !== data.label) {
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
    <NodeTooltip className="h-full w-full">
      {toolbar ? (
        <NodeTooltipContent position={Position.Top} isVisible={focusedNodeId === id} className="max-w-130 w-fit">
          {toolbar}
        </NodeTooltipContent>
      ) : null}
      {tooltip ? (
        <NodeTooltipContent position={Position.Bottom} isVisible={focusedNodeId === id} className="max-w-130 min-w-100 w-fit shadow">
          {tooltip}
        </NodeTooltipContent>
      ) : null}
      <NodeTooltipTrigger className="relative h-full w-full" onBlur={onBlur} ref={ref}>
        {/* 标题和状态在卡片外部左上角 */}
        <div className="absolute -top-6 left-0 mb-1 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <StatusIndicator status={status} error={statusData?.error} />
            {isEditingLabel ? (
              <input
                type="text"
                value={editLabelValue}
                onChange={e => setEditLabelValue(e.target.value)}
                onBlur={handleLabelSave}
                onKeyDown={handleLabelKeyDown}
                className="min-w-0 flex-1 rounded border-none bg-transparent px-1 py-0.5 text-xs outline-none"
                style={{ width: `${Math.max((editLabelValue?.length || 0) * 8, 60)}px` }}
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
        <div className={cn('group relative h-full w-full', !isResizing && 'transition-all duration-200')}>
          {/* 调整大小控制器 */}
          {resizeEnabled && selected && (
            <NodeResizer
              minWidth={minWidth}
              minHeight={minHeight}
              maxWidth={maxWidth}
              maxHeight={maxHeight}
              isVisible={selected}
              onResizeStart={handleResizeStart}
              onResize={handleResize}
              onResizeEnd={handleResizeEnd}
              lineStyle={{ display: 'none' }}
              handleStyle={{ opacity: 0 }}
            />
          )}

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
          {children && (
            <div
              className={cn(
                'bg-card rounded-sm p-1 shadow-sm',
                getStatusStyle(status),
                focusedNodeId === id ? 'border-primary' : selected ? 'border-chart-1' : '',
                // 如果节点有固定尺寸，使用固定尺寸；否则使用自适应
                // 注意：宽度相关的类放在最后，确保 w-full 优先级高于传入的 className
                node?.width && node?.height ? 'h-full w-full' : 'h-fit w-full',
                // 只有在没有固定尺寸时才应用传入的 className，避免覆盖 w-full
                !(node?.width && node?.height) && className,
              )}
            >
              {children}
            </div>
          )}

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
      </NodeTooltipTrigger>
    </NodeTooltip>
  );
}

const StatusIndicator = ({ status, error }: { status: NodeStatus; error?: string }) => {
  // 获取状态指示器
  switch (status) {
    case NodeStatus.PROCESSING:
      return <div className="bg-chart-2 h-3 w-3 animate-pulse rounded-full" />;
    case NodeStatus.COMPLETED:
      return <div className="bg-success h-3 w-3 rounded-full" />;
    case NodeStatus.FAILED:
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="bg-destructive h-3 w-3 rounded-full" />
          </TooltipTrigger>
          <TooltipContent side="top">{error}</TooltipContent>
        </Tooltip>
      );
    case NodeStatus.PENDING:
      return <div className="bg-chart-4 h-3 w-3 rounded-full" />;
    case NodeStatus.PAUSED:
      return <div className="bg-secondary h-3 w-3 rounded-full" />;
    default:
      return <div className="bg-secondary h-3 w-3 rounded-full" />;
  }
};
