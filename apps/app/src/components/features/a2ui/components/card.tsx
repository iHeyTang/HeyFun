'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import React from 'react';
import type { A2UIComponent } from '../types';

export interface A2UICardComponent extends A2UIComponent {
  type: 'card';
  title?: string;
  content?: string;
}

type A2UIEvent = { type: string; componentId: string; data?: Record<string, unknown> };

interface A2UICardProps {
  component: A2UICardComponent;
  style: React.CSSProperties;
  className?: string;
  onEvent?: (event: A2UIEvent) => void;
  renderComponent?: (component: A2UIComponent, onEvent?: (event: A2UIEvent) => void) => React.ReactNode;
}

export function A2UICard({ component, style, className, onEvent, renderComponent }: A2UICardProps) {
  return (
    <Card className={className} style={style}>
      {(component.title || component.content) && (
        <CardHeader>
          {component.title && <CardTitle>{component.title}</CardTitle>}
          {component.content && <CardDescription>{component.content}</CardDescription>}
        </CardHeader>
      )}
      {component.children && component.children.length > 0 && (
        <CardContent className="space-y-4">
          {component.children.map((child, index) => (
            <React.Fragment key={child.id || index}>
              {renderComponent ? renderComponent(child, onEvent) : null}
            </React.Fragment>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

