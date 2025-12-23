'use client';

import { cn } from '@/lib/utils';
import React from 'react';
import type { A2UIComponent } from '../types';

export interface A2UIRadioComponent extends A2UIComponent {
  type: 'radio';
  label: string;
  value: string;
  checked?: boolean;
  group?: string;
}

interface A2UIRadioProps {
  component: A2UIRadioComponent;
  style: React.CSSProperties;
  className?: string;
  onEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}

export function A2UIRadio({ component, style, className, onEvent }: A2UIRadioProps) {
  return (
    <label className={cn('flex items-center gap-2', className)} style={style} data-component-id={component.id}>
      <input
        type="radio"
        name={component.group}
        className="h-4 w-4"
        value={component.value}
        checked={component.checked}
        disabled={component.disabled}
        onChange={e => onEvent?.('change', { value: e.target.value })}
      />
      <span>{component.label}</span>
    </label>
  );
}

