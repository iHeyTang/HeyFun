'use client';

import { cn } from '@/lib/utils';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '@xyflow/react';
import { Bot, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatContainer } from '@/components/features/chat/chat-container';
import type { ChatAction } from '@/components/features/chat/chat-container';
import { FlowCanvasRef } from '../../FlowCanvas';
import { getAigcModels } from '@/actions/llm';
import type { ToolExecutionContext } from '@/agents/browser';
import { createFlowCanvasSessionManager } from '@/lib/browser/session-manager';

export interface AgentPanelProps {
  canvasId: string;
  canvasRef: React.RefObject<FlowCanvasRef | null>; // Canvas引用
  className?: string;
  children?: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  defaultCollapsed?: boolean;
  onWidthChange?: (width: number) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  onCreateSession?: () => void; // 新建会话回调
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  canvasId,
  canvasRef,
  className,
  children,
  defaultWidth = 600,
  minWidth = 300,
  maxWidth = 800,
  defaultCollapsed = false,
  onWidthChange,
  onCollapsedChange,
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(defaultWidth);

  // 为当前 FlowCanvas 项目创建专门的 session manager
  const sessionManager = useMemo(() => createFlowCanvasSessionManager(canvasId), [canvasId]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
    },
    [width],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = startXRef.current - e.clientX;
      const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, minWidth), maxWidth);

      setWidth(newWidth);
      onWidthChange?.(newWidth);
    },
    [isResizing, minWidth, maxWidth, onWidthChange],
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleCreateSession = useCallback(async () => {
    // 这里可以通过其他方式触发新建会话
    // 暂时留空，因为现在通过 actions prop 处理
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => {
      const newValue = !prev;
      onCollapsedChange?.(newValue);
      return newValue;
    });
  }, [onCollapsedChange]);

  // 配置工具执行上下文
  const toolExecutionContext: ToolExecutionContext = useMemo(
    () => ({
      canvasRef,
      // 提供动态查询 AIGC 模型的函数
      getAigcModels: async () => {
        try {
          const result = await getAigcModels({});
          return result.data || [];
        } catch (error) {
          console.error('Failed to fetch AIGC models:', error);
          return [];
        }
      },
    }),
    [canvasRef],
  );

  // 定义外部操作按钮
  const chatActions: ChatAction[] = useMemo(
    () => [
      {
        id: 'collapse',
        label: 'Collapse',
        icon: <ChevronRight className="size-4" />,
        onClick: toggleCollapsed,
      },
    ],
    [toggleCollapsed],
  );

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <Panel position="top-right" className="pointer-events-none h-[calc(100%-32px)]">
      <div className="relative flex h-full justify-end">
        {/* 面板主体 - 折叠时移出屏幕但保持挂载 */}
        <div
          ref={panelRef}
          className={cn(
            'relative flex flex-col',
            'bg-white/70 dark:bg-black/70',
            'backdrop-blur-md',
            'border border-gray-200/50 dark:border-gray-800/50',
            'shadow-xl',
            'rounded-xl',
            'overflow-hidden',
            'transition-transform duration-300 ease-in-out',
            // 折叠时：移出屏幕 + 禁用交互
            isCollapsed ? 'pointer-events-none translate-x-full opacity-0' : 'pointer-events-auto translate-x-0 opacity-100',
            className,
          )}
          style={{
            width: `${width}px`,
          }}
        >
          {/* 拖拽调整宽度的把手 */}
          {!isCollapsed && (
            <div
              className={cn(
                'absolute left-0 top-0 z-10 h-full w-3 cursor-ew-resize',
                'group flex items-center justify-center',
                'transition-all duration-200',
              )}
              onMouseDown={handleMouseDown}
            >
              <div
                className={cn(
                  'h-16 w-0.5 rounded-full',
                  'bg-gray-300/40 dark:bg-gray-600/40',
                  'group-hover:bg-gray-400/60 dark:group-hover:bg-gray-500/60',
                  'group-hover:h-20',
                  'transition-all duration-200',
                  isResizing && 'h-24 bg-gray-400/80 dark:bg-gray-500/80',
                )}
              />
            </div>
          )}

          {/* 面板内容 */}
          <div className="flex-1 overflow-auto">
            <ChatContainer
              sessionManager={sessionManager}
              toolExecutionContext={toolExecutionContext}
              actions={chatActions}
              apiPrefix="/api/flowcanvas/agent"
            />
            {children}
          </div>
        </div>

        {/* 折叠时的切换按钮 */}
        {isCollapsed && <ToggleButton toggleCollapsed={toggleCollapsed} />}
      </div>
    </Panel>
  );
};

const ToggleButton = ({ toggleCollapsed }: { toggleCollapsed: () => void }) => {
  return (
    <Button
      onClick={toggleCollapsed}
      variant="default"
      size="icon"
      className={cn('pointer-events-auto absolute right-2 top-3 z-20', 'rounded-full', 'animate-in fade-in-0 zoom-in-95', 'duration-300 ease-out')}
    >
      <Bot className="size-4 transition-transform duration-200" />
    </Button>
  );
};

export default AgentPanel;
