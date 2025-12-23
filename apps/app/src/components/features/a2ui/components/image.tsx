'use client';

import { cn } from '@/lib/utils';
import React from 'react';
import type { A2UIComponent } from '../types';

export interface A2UIImageComponent extends A2UIComponent {
  type: 'image';
  src: string;
  alt?: string;
  width?: string | number;
  height?: string | number;
}

interface A2UIImageProps {
  component: A2UIImageComponent;
  style: React.CSSProperties;
  className?: string;
}

export function A2UIImage({ component, style, className }: A2UIImageProps) {
  return (
    <img
      src={component.src}
      alt={component.alt || ''}
      className={cn('rounded-md', className)}
      style={{ ...style, width: component.width, height: component.height }}
    />
  );
}

