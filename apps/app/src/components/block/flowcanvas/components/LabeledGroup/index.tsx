import React, { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { NodeResizer, Panel, type NodeProps, type PanelPosition } from '@xyflow/react';

import { cn } from '@/lib/utils';

/* GROUP NODE Label ------------------------------------------------------- */

export type GroupNodeLabelProps = HTMLAttributes<HTMLDivElement>;

export const GroupNodeLabel = forwardRef<HTMLDivElement, GroupNodeLabelProps>(({ children, className, ...props }, ref) => {
  return (
    <div ref={ref} className="h-full w-full" {...props}>
      <div className={cn('bg-secondary text-card-foreground w-fit p-2 text-xs', className)}>{children}</div>
    </div>
  );
});

GroupNodeLabel.displayName = 'GroupNodeLabel';

export type GroupNodeProps = Partial<NodeProps> & {
  id: string; // id 是必需的
  label?: ReactNode;
  position?: PanelPosition;
};

/* GROUP NODE -------------------------------------------------------------- */

export const GroupNode = forwardRef<HTMLDivElement, GroupNodeProps>(({ label, position = 'top-left', selected, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-muted/30 border-muted-foreground/20 relative h-full w-full rounded-lg border-1 border-dashed',
        selected && 'border-primary/50',
      )}
      style={{ width: 'calc(100% + 120px)', height: 'calc(100% + 120px)', margin: '-60px' }}
    >
      <NodeResizer minWidth={100} minHeight={100} lineStyle={{ border: 'none' }} handleStyle={{ border: 'none', backgroundColor: 'transparent' }} />
      {label && <div className="bg-muted/80 text-muted-foreground absolute top-2 left-2 rounded px-2 py-1 text-xs font-medium">{label}</div>}
    </div>
  );
});

GroupNode.displayName = 'GroupNode';
