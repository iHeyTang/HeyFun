'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import React from 'react';
import type { A2UIComponent } from '../types';

export interface A2UISelectComponent extends A2UIComponent {
  type: 'select';
  options: Array<{ label: string; value: string }>;
  value?: string;
  placeholder?: string;
  required?: boolean;
}

interface A2UISelectProps {
  component: A2UISelectComponent;
  style: React.CSSProperties;
  className?: string;
  onEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}

export function A2UISelect({ component, style, className, onEvent }: A2UISelectProps) {
  return (
    <Select value={component.value || undefined} disabled={component.disabled} onValueChange={value => onEvent?.('change', { value })}>
      <SelectTrigger className={cn('w-full', className)} style={style} data-component-id={component.id}>
        <SelectValue placeholder={component.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {component.options?.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
