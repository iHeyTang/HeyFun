'use client';

import type { A2UIMessage, A2UIState } from '@/components/features/a2ui';
import { useA2UIState } from '@/components/features/a2ui/use-a2ui-state';
import React from 'react';
import { A2UIRenderer } from './a2ui-renderer';

interface A2UIMessageProps {
  message: A2UIMessage;
  state?: A2UIState;
  onEvent?: (event: { type: string; componentId: string; data?: Record<string, unknown> }) => void;
  className?: string;
}

/**
 * A2UI 消息组件
 * 处理 A2UI 消息的渲染和状态管理
 */
export function A2UIMessageComponent({ message, state: externalState, onEvent, className }: A2UIMessageProps) {
  // 如果提供了外部状态，直接使用；否则使用内部状态管理
  const internalState = useA2UIState(externalState ? undefined : message);
  const state = externalState || internalState.state;

  // 使用 ref 跟踪已处理的消息，避免重复处理
  const lastProcessedMessageRef = React.useRef<{ id?: string; type: string } | null>(null);

  // 应用消息更新到状态（只在消息变化时）
  React.useEffect(() => {
    if (!externalState) {
      const currentKey = `${message.id || 'no-id'}-${message.type}`;
      const lastKey = lastProcessedMessageRef.current
        ? `${lastProcessedMessageRef.current.id || 'no-id'}-${lastProcessedMessageRef.current.type}`
        : null;

      // 只在消息真正变化时才更新
      if (currentKey !== lastKey) {
        internalState.applyMessageUpdate(message);
        lastProcessedMessageRef.current = { id: message.id, type: message.type };
      }
    }
    // 只依赖 message.id 和 message.type，避免整个 message 对象变化导致的循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, message.type, externalState]);

  const handleEvent = (event: { type: string; componentId: string; data?: Record<string, unknown> }) => {
    if (onEvent) {
      onEvent(event);
    }
  };

  // 根据消息类型渲染
  switch (message.type) {
    case 'ui/init':
      if (message.component) {
        // 调试：检查组件
        console.log('[A2UIMessageComponent] 渲染组件:', message.component);
        return (
          <div className={className}>
            <A2UIRenderer component={message.component} onEvent={handleEvent} />
          </div>
        );
      }
      if (message.components) {
        return (
          <div className={className}>
            {message.components.map((component, index) => (
              <A2UIRenderer key={component.id || index} component={component} onEvent={handleEvent} />
            ))}
          </div>
        );
      }
      console.warn('[A2UIMessageComponent] ui/init 消息没有 component 或 components');
      return null;

    case 'ui/update':
      if (message.component && message.targetId) {
        // 更新后的组件直接渲染
        return (
          <div className={className}>
            <A2UIRenderer component={message.component} onEvent={handleEvent} />
          </div>
        );
      }
      // 如果没有提供 component，尝试从状态中获取
      if (message.targetId) {
        const component = state.components.get(message.targetId);
        if (component) {
          return (
            <div className={className}>
              <A2UIRenderer component={component} onEvent={handleEvent} />
            </div>
          );
        }
      }
      return null;

    case 'ui/append':
      if (message.component && message.targetId) {
        return (
          <div className={className}>
            <A2UIRenderer component={message.component} onEvent={handleEvent} />
          </div>
        );
      }
      return null;

    case 'ui/remove':
      return null; // 移除操作不需要渲染

    case 'ui/event':
      return null; // 事件消息不需要渲染

    case 'ui/complete':
      // 渲染完整状态
      return (
        <div className={className}>
          {Array.from(state.components.values())
            .filter(comp => state.rootComponents.includes(comp.id))
            .map(component => (
              <A2UIRenderer key={component.id} component={component} onEvent={handleEvent} />
            ))}
        </div>
      );

    default:
      return null;
  }
}

/**
 * 创建初始状态
 */
function createInitialState(): A2UIState {
  return {
    components: new Map(),
    rootComponents: [],
    version: 0,
  };
}
