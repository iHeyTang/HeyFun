'use client';

import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import React from 'react';
import type { A2UIComponent } from './types';
import {
  A2UIButton,
  A2UICard,
  A2UICheckbox,
  A2UIContainer,
  A2UIForm,
  A2UIImage,
  A2UIInput,
  A2UILink,
  A2UIList,
  A2UIRadio,
  A2UISelect,
  A2UIText,
  A2UITextarea,
  type A2UIButtonComponent,
  type A2UICardComponent,
  type A2UICheckboxComponent,
  type A2UIContainerComponent,
  type A2UIFormComponent,
  type A2UIImageComponent,
  type A2UIInputComponent,
  type A2UILinkComponent,
  type A2UIListComponent,
  type A2UIRadioComponent,
  type A2UISelectComponent,
  type A2UITextareaComponent,
  type A2UITextComponent,
} from './components';

interface A2UIRendererProps {
  component: A2UIComponent;
  onEvent?: (event: { type: string; componentId: string; data?: Record<string, unknown> }) => void;
  className?: string;
}

/**
 * A2UI 组件渲染器
 * 根据组件类型渲染对应的 React 组件
 */
export function A2UIRenderer({ component, onEvent, className }: A2UIRendererProps) {
  if (component.visible === false) {
    return null;
  }

  // 调试：检查组件类型
  if (!component.type) {
    console.error('[A2UIRenderer] 组件缺少 type 属性:', component);
    return null;
  }

  const handleEvent = (eventType: string, data?: Record<string, unknown>) => {
    if (onEvent) {
      onEvent({
        type: eventType,
        componentId: component.id,
        data,
      });
    }
  };

  const style = component.style ? convertStyle(component.style as Record<string, unknown>) : {};

  // 递归渲染函数，用于复合组件
  const renderComponent = (comp: A2UIComponent, eventHandler?: typeof onEvent) => <A2UIRenderer component={comp} onEvent={eventHandler} />;

  switch (component.type) {
    case 'text':
      return <A2UIText component={component as A2UITextComponent} style={style} className={className} />;
    case 'button':
      return <A2UIButton component={component as A2UIButtonComponent} style={style} className={className} onEvent={handleEvent} />;
    case 'input':
      return <A2UIInput component={component as A2UIInputComponent} style={style} className={className} onEvent={handleEvent} />;
    case 'textarea':
      return <A2UITextarea component={component as A2UITextareaComponent} style={style} className={className} onEvent={handleEvent} />;
    case 'select':
      return <A2UISelect component={component as A2UISelectComponent} style={style} className={className} onEvent={handleEvent} />;
    case 'checkbox':
      return <A2UICheckbox component={component as A2UICheckboxComponent} style={style} className={className} onEvent={handleEvent} />;
    case 'radio':
      return <A2UIRadio component={component as A2UIRadioComponent} style={style} className={className} onEvent={handleEvent} />;
    case 'image':
      return <A2UIImage component={component as A2UIImageComponent} style={style} className={className} />;
    case 'link':
      return <A2UILink component={component as A2UILinkComponent} style={style} className={className} />;
    case 'list':
      return (
        <A2UIList
          component={component as A2UIListComponent}
          style={style}
          className={className}
          onEvent={onEvent}
          renderComponent={renderComponent}
        />
      );
    case 'card':
      return (
        <A2UICard
          component={component as A2UICardComponent}
          style={style}
          className={className}
          onEvent={onEvent}
          renderComponent={renderComponent}
        />
      );
    case 'form':
      return (
        <A2UIForm
          component={component as A2UIFormComponent}
          style={style}
          className={className}
          onEvent={onEvent}
          renderComponent={renderComponent}
        />
      );
    case 'container':
      return (
        <A2UIContainer
          component={component as A2UIContainerComponent}
          style={style}
          className={className}
          onEvent={onEvent}
          renderComponent={renderComponent}
        />
      );
    case 'divider':
      return <Separator className={className} style={style} />;
    case 'spacer':
      return <div className={className} style={style} />;
    default:
      console.warn('[A2UIRenderer] 未支持的组件类型:', component.type);
      return null;
  }
}

/**
 * 转换 A2UI 样式为 React 样式
 */
function convertStyle(style: Record<string, unknown>): React.CSSProperties {
  const reactStyle: React.CSSProperties = {};

  Object.entries(style).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      // 转换 kebab-case 到 camelCase
      const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      reactStyle[camelKey as keyof React.CSSProperties] = value as any;
    }
  });

  return reactStyle;
}
