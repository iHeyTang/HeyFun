'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React from 'react';
import type { A2UIComponent } from '../types';

export interface A2UIInputComponent extends A2UIComponent {
  type: 'input';
  inputType?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  placeholder?: string;
  value?: string;
  required?: boolean;
  label?: string;
}

interface A2UIInputProps {
  component: A2UIInputComponent;
  style: React.CSSProperties;
  className?: string;
  onEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}

export function A2UIInput({ component, style, className, onEvent }: A2UIInputProps) {
  const hasLabel = component.label;

  const inputElement = (
    <Input
      type={component.inputType || 'text'}
      data-component-id={component.id}
      className={className}
      style={hasLabel ? undefined : style}
      placeholder={component.placeholder}
      value={component.value as string}
      required={component.required}
      disabled={component.disabled}
      onChange={e => onEvent?.('change', { value: e.target.value })}
    />
  );

  if (hasLabel) {
    return (
      <div className="space-y-2" style={style}>
        <Label htmlFor={component.id} className="text-sm font-medium leading-none">
          {component.label}
        </Label>
        {inputElement}
      </div>
    );
  }

  return inputElement;
}

