'use client';

import { cn } from '@/lib/utils';
import React from 'react';
import type { A2UIComponent, A2UILayoutDirection } from '../types';

export interface A2UIContainerComponent extends A2UIComponent {
  type: 'container';
  direction?: A2UILayoutDirection;
}

type A2UIEvent = { type: string; componentId: string; data?: Record<string, unknown> };

interface A2UIContainerProps {
  component: A2UIContainerComponent;
  style: React.CSSProperties;
  className?: string;
  onEvent?: (event: A2UIEvent) => void;
  renderComponent?: (component: A2UIComponent, onEvent?: (event: A2UIEvent) => void) => React.ReactNode;
}

export function A2UIContainer({ component, style, className, onEvent, renderComponent }: A2UIContainerProps) {
  const directionClass = component.direction === 'row' ? 'flex-row' : 'flex-col';

  // 调试：检查容器组件
  if (!component.children || component.children.length === 0) {
    console.warn('[A2UIContainer] 容器组件没有子组件:', component);
  }

  return (
    <div className={cn('flex', directionClass, className)} style={style}>
      {component.children && component.children.length > 0 ? (
        component.children.map((child, index) => (
          <React.Fragment key={child.id || index}>
            {renderComponent ? renderComponent(child, onEvent) : null}
          </React.Fragment>
        ))
      ) : (
        <span className="text-muted-foreground text-xs">空容器</span>
      )}
    </div>
  );
}

