import { cn } from '@/lib/utils';
import { NodeToolbar, type NodeToolbarProps } from '@xyflow/react';
import React, { createContext, forwardRef, useCallback, useContext, useState, type HTMLAttributes } from 'react';

/* TOOLTIP CONTEXT ---------------------------------------------------------- */

type TooltipContextType = {
  isVisible: boolean;
  showTooltip: () => void;
  hideTooltip: () => void;
  setLocked: (locked: boolean) => void;
};

const TooltipContext = createContext<TooltipContextType | null>(null);

/* TOOLTIP NODE ------------------------------------------------------------- */

export const NodeTooltip = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ children }, ref) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const showTooltip = useCallback(() => setIsVisible(true), []);
  const hideTooltip = useCallback(() => {
    // 只有在未锁定时才隐藏
    if (!isLocked) {
      setIsVisible(false);
    }
  }, [isLocked]);
  const setLocked = useCallback((locked: boolean) => setIsLocked(locked), []);

  return <TooltipContext.Provider value={{ isVisible, showTooltip, hideTooltip, setLocked }}>{children}</TooltipContext.Provider>;
});
NodeTooltip.displayName = 'NodeTooltip';

/* TOOLTIP TRIGGER ---------------------------------------------------------- */

export const NodeTooltipTrigger = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => {
  const tooltipContext = useContext(TooltipContext);
  if (!tooltipContext) {
    throw new Error('NodeTooltipTrigger must be used within NodeTooltip');
  }
  const { showTooltip, hideTooltip, setLocked } = tooltipContext;

  const onMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      props.onMouseEnter?.(e);
      showTooltip();
    },
    [props, showTooltip],
  );

  const onMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      props.onMouseLeave?.(e);
      hideTooltip();
    },
    [props, hideTooltip],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      props.onMouseDown?.(e);
      // 点击或拖动时锁定 tooltip，防止消失
      setLocked(true);
    },
    [props, setLocked],
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      props.onMouseUp?.(e);
      // 释放后解锁 tooltip
      setLocked(false);
    },
    [props, setLocked],
  );

  return <div ref={ref} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseDown={onMouseDown} onMouseUp={onMouseUp} {...props} />;
});
NodeTooltipTrigger.displayName = 'NodeTooltipTrigger';

/* TOOLTIP CONTENT ---------------------------------------------------------- */

// /**
//  * A component that displays the tooltip content based on visibility context.
//  */

export const NodeTooltipContent = forwardRef<HTMLDivElement, NodeToolbarProps>(
  ({ children, position, className, isVisible: externalIsVisible, ...props }, ref) => {
    const tooltipContext = useContext(TooltipContext);
    if (!tooltipContext) {
      throw new Error('NodeTooltipContent must be used within NodeTooltip');
    }
    const { isVisible: contextIsVisible } = tooltipContext;

    // 如果外部传入了 isVisible，使用外部的；否则使用 context 的
    const finalIsVisible = externalIsVisible !== undefined ? externalIsVisible : contextIsVisible;

    return (
      <div ref={ref}>
        <NodeToolbar
          isVisible={finalIsVisible}
          className={cn('bg-popover shadow-luxury max-w-125 rounded-sm', className)}
          tabIndex={1}
          position={position}
          {...props}
        >
          {children}
        </NodeToolbar>
      </div>
    );
  },
);
NodeTooltipContent.displayName = 'NodeTooltipContent';
