import React, { createContext, useCallback, useContext, useState } from 'react';
import { NodeStatusData } from './scheduler/core';
import { FlowGraphContextHandlers } from './scheduler/state';
import { NodeStatus } from './types/nodes';

// Context状态接口
interface FlowGraphContextState extends FlowGraphContextHandlers {
  // 状态存储：使用nodeId作为key
  nodeStatuses: Map<string, NodeStatusData>;
  // 聚焦状态管理
  focusedNodeId: string | null;
  setFocusedNodeId: (nodeId: string | null) => void;
}

// 创建Context
const FlowGraphContext = createContext<FlowGraphContextState | null>(null);

// Provider组件的Props
interface FlowGraphProviderProps {
  children: React.ReactNode;
  initialStatuses?: Map<string, NodeStatusData>;
}

// Provider组件
export function FlowGraphProvider({ children, initialStatuses = new Map() }: FlowGraphProviderProps) {
  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeStatusData>>(initialStatuses);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // 获取节点状态 - 不使用useCallback，确保总是获取最新状态
  const getNodeStatus = (nodeId: string): NodeStatusData | undefined => {
    const result = nodeStatuses.get(nodeId);
    return result;
  };

  // 更新节点元数据（不改变status）
  const updateNodeMetadata = useCallback((nodeId: string, metadata: Partial<NodeStatusData>) => {
    setNodeStatuses(prev => {
      const newMap = new Map(prev);
      const currentStatus = newMap.get(nodeId);

      if (currentStatus) {
        const updatedStatus: NodeStatusData = {
          ...currentStatus,
          ...metadata,
          lastUpdated: new Date(),
          metadata: { ...currentStatus.metadata, ...metadata.metadata },
        };
        newMap.set(nodeId, updatedStatus);
      }

      return newMap;
    });
  }, []);

  // 清除单个节点状态
  const clearNodeStatus = useCallback((nodeId: string) => {
    setNodeStatuses(prev => {
      const newMap = new Map(prev);
      newMap.delete(nodeId);
      return newMap;
    });
  }, []);

  // 清除所有状态
  const clearAllStatuses = useCallback(() => {
    setNodeStatuses(new Map());
  }, []);

  // 批量设置状态
  const setNodeStatus = useCallback((updates: Array<{ nodeId: string; status: NodeStatus; metadata?: Partial<NodeStatusData> }>) => {
    setNodeStatuses(prev => {
      const newMap = new Map(prev);

      updates.forEach(({ nodeId, status, metadata = {} }) => {
        const previousStatus = newMap.get(nodeId);

        const newStatusData: NodeStatusData = {
          status,
          auto: metadata.auto ?? previousStatus?.auto ?? true,
          lastUpdated: new Date(),
          executionTime: metadata.executionTime ?? previousStatus?.executionTime,
          error: metadata.error ?? (status === NodeStatus.FAILED ? previousStatus?.error : undefined),
          metadata: { ...previousStatus?.metadata, ...metadata.metadata },
        };

        newMap.set(nodeId, newStatusData);
      });

      return newMap;
    });

    // 对于COMPLETED状态，强制刷新以确保UI立即更新
    if (updates.some(({ status }) => status === NodeStatus.COMPLETED)) {
      setTimeout(() => {
        setRefreshCounter((prev: number) => prev + 1);
      }, 5);
    }
  }, []);

  // 获取所有状态 - 不使用useCallback，确保总是获取最新状态
  const getAllStatuses = () => {
    console.log('NodeStatusContext.getAllStatuses():', nodeStatuses);
    return new Map(nodeStatuses);
  };

  const contextValue: FlowGraphContextState = {
    nodeStatuses,
    focusedNodeId,
    setFocusedNodeId,
    setNodeStatus,
    getNodeStatus,
    updateNodeMetadata,
    clearNodeStatus,
    clearAllStatuses,
    getAllStatuses,
  };

  return <FlowGraphContext.Provider value={contextValue}>{children}</FlowGraphContext.Provider>;
}

// Hook for consuming the context
export function useFlowGraphContext() {
  const context = useContext(FlowGraphContext);
  if (!context) {
    throw new Error('useFlowGraphContext must be used within a FlowGraphProvider');
  }
  return context;
}

// 针对单个节点的Hook
export function useNodeStatusById(nodeId: string) {
  const { getNodeStatus, setNodeStatus, updateNodeMetadata, clearNodeStatus } = useFlowGraphContext();

  const nodeStatus = getNodeStatus(nodeId);

  const updateStatus = useCallback(
    (status: NodeStatus, metadata?: Partial<NodeStatusData>) => {
      setNodeStatus([{ nodeId, status, metadata }]);
    },
    [nodeId, setNodeStatus],
  );

  const updateMetadata = useCallback(
    (metadata: Partial<NodeStatusData>) => {
      updateNodeMetadata(nodeId, metadata);
    },
    [nodeId, updateNodeMetadata],
  );

  const clearStatus = useCallback(() => {
    clearNodeStatus(nodeId);
  }, [nodeId, clearNodeStatus]);

  return {
    status: nodeStatus?.status ?? NodeStatus.IDLE,
    statusData: nodeStatus,
    updateStatus,
    updateMetadata,
    clearStatus,
  };
}
