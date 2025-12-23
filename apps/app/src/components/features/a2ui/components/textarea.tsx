'use client';

import { Textarea } from '@/components/ui/textarea';
import React from 'react';
import type { A2UIComponent } from '../types';

export interface A2UITextareaComponent extends A2UIComponent {
  type: 'textarea';
  placeholder?: string;
  value?: string;
  rows?: number;
  required?: boolean;
}

interface A2UITextareaProps {
  component: A2UITextareaComponent;
  style: React.CSSProperties;
  className?: string;
  onEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}

export function A2UITextarea({ component, style, className, onEvent }: A2UITextareaProps) {
  return (
    <Textarea
      data-component-id={component.id}
      className={className}
      style={style}
      placeholder={component.placeholder}
      value={component.value}
      rows={component.rows}
      required={component.required}
      disabled={component.disabled}
      onChange={e => onEvent?.('change', { value: e.target.value })}
    />
  );
}

