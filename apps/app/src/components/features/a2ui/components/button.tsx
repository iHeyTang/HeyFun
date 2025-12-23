'use client';

import { Button } from '@/components/ui/button';
import React from 'react';
import type { A2UIComponent } from '../types';

export interface A2UIButtonComponent extends A2UIComponent {
  type: 'button';
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
}

interface A2UIButtonProps {
  component: A2UIButtonComponent;
  style: React.CSSProperties;
  className?: string;
  onEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}

export function A2UIButton({ component, style, className, onEvent }: A2UIButtonProps) {
  const variantMap: Record<string, 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'> = {
    primary: 'default',
    secondary: 'secondary',
    outline: 'outline',
    ghost: 'ghost',
    danger: 'destructive',
  };

  const sizeMap: Record<string, 'default' | 'sm' | 'lg'> = {
    small: 'sm',
    medium: 'default',
    large: 'lg',
  };

  return (
    <Button
      type="button"
      variant={variantMap[component.variant || 'primary'] || 'default'}
      size={sizeMap[component.size || 'medium'] || 'default'}
      className={className}
      style={style}
      disabled={component.disabled || component.loading}
      onClick={() => onEvent?.('click', { label: component.label })}
    >
      {component.loading ? '加载中...' : component.label}
    </Button>
  );
}

