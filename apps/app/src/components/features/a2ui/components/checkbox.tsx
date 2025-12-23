'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import React from 'react';
import type { A2UIComponent } from '../types';

export interface A2UICheckboxComponent extends A2UIComponent {
  type: 'checkbox';
  label: string;
  checked?: boolean;
  required?: boolean;
}

interface A2UICheckboxProps {
  component: A2UICheckboxComponent;
  style: React.CSSProperties;
  className?: string;
  onEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}

export function A2UICheckbox({ component, style, className, onEvent }: A2UICheckboxProps) {
  return (
    <div className={cn('flex items-center gap-2', className)} style={style} data-component-id={component.id}>
      <Checkbox
        id={component.id}
        checked={component.checked}
        required={component.required}
        disabled={component.disabled}
        onCheckedChange={checked => onEvent?.('change', { checked, value: checked })}
      />
      <Label htmlFor={component.id} className="cursor-pointer font-normal">
        {component.label}
      </Label>
    </div>
  );
}

