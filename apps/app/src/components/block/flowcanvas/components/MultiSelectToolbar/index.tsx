import { cn } from '@/lib/utils';
import { ViewportPortal, useReactFlow } from '@xyflow/react';
import { PlayIcon } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

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

export interface MultiSelectToolbarRef {
  updatePosition: (selectedNodeIds: string[]) => void;
}

export const MultiSelectToolbar = forwardRef<MultiSelectToolbarRef, MultiSelectToolbarProps>(
  ({ selecting, selectedNodes, className, onExecuteSelectedNodes }, ref) => {
    const { getNodesBounds } = useReactFlow();

    const toolbarRef = useRef<HTMLDivElement>(null);

    // 暴露更新位置的方法给父组件
    useImperativeHandle(
      ref,
      () => ({
        updatePosition: (selectedNodeIds: string[]) => {
          if (selectedNodeIds.length > 1 && toolbarRef.current) {
            const bounds = getNodesBounds(selectedNodeIds);
            toolbarRef.current.style.transform = `translate(${bounds.x}px, ${bounds.y - 40}px)`;
          }
        },
      }),
      [getNodesBounds, toolbarRef],
    );

    // 执行选中的节点
    const handleExecuteSelectedNodes = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      console.log('handleExecuteSelectedNodes 被调用', { event, selectedNodes });
      event.stopPropagation();
      event.preventDefault();

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

    const bounds = useMemo(() => {
      return getNodesBounds(selectedNodes);
    }, [selectedNodes]);

    const updatePosition = (selectedNodeIds: string[]) => {
      if (selectedNodeIds.length > 1 && toolbarRef.current) {
        toolbarRef.current.style.transform = `translate(${bounds.x}px, ${bounds.y - 60}px)`;
      }
    };

    useEffect(() => {
      updatePosition(selectedNodes);
    }, [selectedNodes]);

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
              className={cn('flex items-center gap-2 rounded-lg border-2 border-theme-chart-1 bg-theme-card p-2 shadow-theme-luxury', className)}
              style={{ pointerEvents: 'auto' }}
              onClick={e => {
                console.log('工具栏容器被点击', e);
                e.stopPropagation();
              }}
            >
              {/* 执行按钮 */}
              <button
                onClick={handleExecuteSelectedNodes}
                onMouseDown={e => {
                  console.log('按钮 mousedown 事件', e);
                  e.stopPropagation();
                }}
                onMouseUp={e => {
                  console.log('按钮 mouseup 事件', e);
                  e.stopPropagation();
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-theme-primary px-3 py-1.5 text-sm font-medium text-theme-primary-foreground transition-colors duration-200 hover:bg-theme-button-primary-hover"
                style={{ pointerEvents: 'auto' }}
                title="执行选中节点"
                type="button"
              >
                <PlayIcon className="h-4 w-4" />
                执行
              </button>
            </div>
          )}
        </div>
      </ViewportPortal>
    );
  },
);

MultiSelectToolbar.displayName = 'MultiSelectToolbar';

export default MultiSelectToolbar;
