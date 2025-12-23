import { useState, useCallback } from 'react';
import type { A2UIState, A2UIMessage, A2UIComponent } from './types';

/**
 * A2UI 状态管理 Hook
 * 管理单个 A2UI 实例的状态，支持增量更新
 */
export function useA2UIState(initialMessage?: A2UIMessage) {
  const [state, setState] = useState<A2UIState>(() => {
    if (initialMessage) {
      return applyMessage(createInitialState(), initialMessage);
    }
    return createInitialState();
  });

  const [messageId, setMessageId] = useState<string | undefined>(initialMessage?.id);

  /**
   * 应用 A2UI 消息到状态
   */
  const applyMessageUpdate = useCallback((message: A2UIMessage) => {
    setState(prevState => {
      const newState = applyMessage(prevState, message);
      if (message.id) {
        setMessageId(message.id);
      }
      return newState;
    });
  }, []);

  /**
   * 获取组件
   */
  const getComponent = useCallback(
    (componentId: string): A2UIComponent | undefined => {
      return state.components.get(componentId);
    },
    [state],
  );

  /**
   * 更新组件
   */
  const updateComponent = useCallback((component: A2UIComponent) => {
    setState(prevState => {
      const newState: A2UIState = {
        components: new Map(prevState.components),
        rootComponents: [...prevState.rootComponents],
        version: prevState.version + 1,
      };
      newState.components.set(component.id, component);
      return newState;
    });
  }, []);

  /**
   * 重置状态
   */
  const resetState = useCallback((message?: A2UIMessage) => {
    if (message) {
      setState(applyMessage(createInitialState(), message));
      if (message.id) {
        setMessageId(message.id);
      }
    } else {
      setState(createInitialState());
      setMessageId(undefined);
    }
  }, []);

  return {
    state,
    messageId,
    applyMessageUpdate,
    getComponent,
    updateComponent,
    resetState,
  };
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

/**
 * 应用消息到状态
 */
function applyMessage(state: A2UIState, message: A2UIMessage): A2UIState {
  const newState: A2UIState = {
    components: new Map(state.components),
    rootComponents: [...state.rootComponents],
    version: state.version + 1,
  };

  switch (message.type) {
    case 'ui/init':
      if (message.component) {
        newState.components.set(message.component.id, message.component);
        if (!newState.rootComponents.includes(message.component.id)) {
          newState.rootComponents.push(message.component.id);
        }
      }
      if (message.components) {
        message.components.forEach(component => {
          newState.components.set(component.id, component);
          if (!newState.rootComponents.includes(component.id)) {
            newState.rootComponents.push(component.id);
          }
        });
      }
      break;

    case 'ui/update':
      if (message.component && message.targetId) {
        newState.components.set(message.targetId, message.component);
      }
      break;

    case 'ui/append':
      if (message.component && message.targetId) {
        const parent = newState.components.get(message.targetId);
        if (parent && parent.children) {
          parent.children.push(message.component);
          newState.components.set(message.targetId, parent);
        }
        newState.components.set(message.component.id, message.component);
      }
      break;

    case 'ui/remove':
      if (message.targetId) {
        newState.components.delete(message.targetId);
        newState.rootComponents = newState.rootComponents.filter(id => id !== message.targetId);
      }
      break;
  }

  return newState;
}
