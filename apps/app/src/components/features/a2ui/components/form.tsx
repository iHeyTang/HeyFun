'use client';

import { cn } from '@/lib/utils';
import React from 'react';
import type { A2UIComponent } from '../types';
import type { A2UICheckboxComponent } from './checkbox';
import type { A2UIInputComponent } from './input';
import type { A2UIRadioComponent } from './radio';
import type { A2UISelectComponent } from './select';

export interface A2UIFormComponent extends A2UIComponent {
  type: 'form';
  action?: string;
  method?: 'get' | 'post';
}

type A2UIEvent = { type: string; componentId: string; data?: Record<string, unknown> };

interface A2UIFormProps {
  component: A2UIFormComponent;
  style: React.CSSProperties;
  className?: string;
  onEvent?: (event: A2UIEvent) => void;
  renderComponent?: (component: A2UIComponent, onEvent?: (event: A2UIEvent) => void) => React.ReactNode;
}

export function A2UIForm({ component, style, className, onEvent, renderComponent }: A2UIFormProps) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const formDataRef = React.useRef<Record<string, any>>({});

  // 收集表单数据的辅助函数
  const collectFormData = (): Record<string, any> => {
    const data: Record<string, any> = {};

    // 遍历所有子组件，收集输入字段的值
    const collectFromComponent = (comp: A2UIComponent) => {
      if (comp.type === 'input' || comp.type === 'textarea' || comp.type === 'select') {
        // 从 DOM 中获取当前值
        const input = formRef.current?.querySelector(`[data-component-id="${comp.id}"]`) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement;
        if (input) {
          data[comp.id] = input.value;
        } else if ((comp as A2UIInputComponent | A2UISelectComponent).value !== undefined) {
          // 如果 DOM 中找不到，使用组件的 value 属性
          data[comp.id] = (comp as A2UIInputComponent | A2UISelectComponent).value;
        }
      } else if (comp.type === 'checkbox') {
        const checkbox = formRef.current?.querySelector(`[data-component-id="${comp.id}"]`) as HTMLInputElement;
        if (checkbox) {
          data[comp.id] = checkbox.checked;
        } else if ((comp as A2UICheckboxComponent).checked !== undefined) {
          data[comp.id] = (comp as A2UICheckboxComponent).checked;
        }
      } else if (comp.type === 'radio') {
        const radio = formRef.current?.querySelector(`[data-component-id="${comp.id}"]:checked`) as HTMLInputElement;
        if (radio) {
          data[comp.id] = radio.value;
        } else if ((comp as A2UIRadioComponent).checked) {
          data[comp.id] = (comp as A2UIRadioComponent).value;
        }
      }

      // 递归处理子组件
      if (comp.children) {
        comp.children.forEach(collectFromComponent);
      }
    };

    if (component.children) {
      component.children.forEach(collectFromComponent);
    }

    return data;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 收集所有表单字段的值
    const formData = collectFormData();

    // 触发 submit 事件，传递收集到的表单数据
    if (onEvent) {
      onEvent({
        type: 'submit',
        componentId: component.id,
        data: formData,
      });
    }
  };

  // 处理子组件的事件
  // 使用 useCallback 创建稳定的回调，ref 访问只在事件处理时发生
  const handleChildEvent = React.useCallback(
    (event: A2UIEvent) => {
      // 按钮点击事件：如果按钮在表单内，手动触发表单提交
      // 由于按钮是 type="button"，不会自动触发表单提交，所以需要手动触发
      if (event.type === 'click') {
        const clickedButton = component.children?.find(child => child.id === event.componentId && child.type === 'button');
        // ref 访问只在事件处理时发生，不在渲染期间
        const formElement = formRef.current;
        if (clickedButton && formElement) {
          // 手动触发表单的 submit 事件，这会调用 handleSubmit
          // 使用 requestSubmit 而不是 submit，这样会触发 onSubmit 事件处理器
          formElement.requestSubmit();
          // 不传递 click 事件，避免重复处理
          return;
        }
      }

      // 其他事件正常传递
      if (onEvent) {
        onEvent(event);
      }
    },
    [component.children, onEvent],
  );

  return (
    <form
      ref={formRef}
      className={cn('space-y-6', className)}
      style={style}
      action={component.action}
      method={component.method || 'post'}
      onSubmit={handleSubmit}
    >
      {/* eslint-disable-next-line react-hooks/refs */}
      {component.children?.map((child, index) => (
        <React.Fragment key={child.id || index}>{renderComponent ? renderComponent(child, handleChildEvent) : null}</React.Fragment>
      ))}
    </form>
  );
}
