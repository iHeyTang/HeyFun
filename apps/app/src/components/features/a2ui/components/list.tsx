'use client';

import { cn } from '@/lib/utils';
import React from 'react';
import type { A2UIComponent } from '../types';

export interface A2UIListComponent extends A2UIComponent {
  type: 'list';
  items: A2UIComponent[];
  ordered?: boolean;
}

type A2UIEvent = { type: string; componentId: string; data?: Record<string, unknown> };

interface A2UIListProps {
  component: A2UIListComponent;
  style: React.CSSProperties;
  className?: string;
  onEvent?: (event: A2UIEvent) => void;
  renderComponent?: (component: A2UIComponent, onEvent?: (event: A2UIEvent) => void) => React.ReactNode;
}

export function A2UIList({ component, style, className, onEvent, renderComponent }: A2UIListProps) {
  const ListTag = component.ordered ? 'ol' : 'ul';
  return (
    <ListTag className={cn('list-inside space-y-2', component.ordered ? 'list-decimal' : 'list-disc', className)} style={style}>
      {component.items.map((item, index) => (
        <li key={item.id || index}>
          {renderComponent ? renderComponent(item, onEvent) : null}
        </li>
      ))}
    </ListTag>
  );
}

