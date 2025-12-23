'use client';

import { cn } from '@/lib/utils';
import React from 'react';
import type { A2UIComponent } from '../types';

export interface A2UITextComponent extends A2UIComponent {
  type: 'text';
  content: string;
  variant?: 'body' | 'heading' | 'caption' | 'label';
}

interface A2UITextProps {
  component: A2UITextComponent;
  style: React.CSSProperties;
  className?: string;
}

export function A2UIText({ component, style, className }: A2UITextProps) {
  const variantClasses = {
    heading: 'text-2xl font-semibold tracking-tight',
    body: 'text-base leading-7',
    caption: 'text-sm text-muted-foreground',
    label: 'text-sm font-medium leading-none',
  };

  const Tag = component.variant === 'heading' ? 'h2' : 'p';

  return (
    <Tag className={cn(variantClasses[component.variant || 'body'], className)} style={style}>
      {component.content}
    </Tag>
  );
}

