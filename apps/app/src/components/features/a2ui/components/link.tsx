'use client';

import { cn } from '@/lib/utils';
import React from 'react';
import type { A2UIComponent } from '../types';

export interface A2UILinkComponent extends A2UIComponent {
  type: 'link';
  href: string;
  label: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
}

interface A2UILinkProps {
  component: A2UILinkComponent;
  style: React.CSSProperties;
  className?: string;
}

export function A2UILink({ component, style, className }: A2UILinkProps) {
  return (
    <a
      href={component.href}
      target={component.target || '_self'}
      className={cn('text-primary underline-offset-4 hover:underline', className)}
      style={style}
    >
      {component.label}
    </a>
  );
}

