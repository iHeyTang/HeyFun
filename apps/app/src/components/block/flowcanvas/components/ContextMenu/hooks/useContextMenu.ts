import { addEdge, Connection, Edge, OnConnectEnd, useReactFlow } from '@xyflow/react';
import { useCallback, useState } from 'react';
import { FlowGraphNode } from '../../../types/nodes';
import { useFlowGraph } from '../../../hooks/useFlowGraph';

/**
 * 节点类型定义
 */
export interface NodeType {
  type: string;
  label: string;
  description: string;
  defaultData?: Record<string, any>;
}

/**
 * 待连接的处理器状态
 */
type PendingConnection = { nodeId: string; handleId: string | null };

/**
 * ContextMenu 扩展上下文
 */
export interface ContextMenuExtensionContext {
  // 边的状态
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;

  // 画布引用
  canvasRef: React.RefObject<HTMLElement | null>;

  // 工具方法
  flowGraph: ReturnType<typeof useFlowGraph>;

  // 是否启用节点菜单
  enableNodeMenu: boolean;
}

/**
 * ContextMenu 扩展返回值
 */
export interface ContextMenuExtensionResult {
  // 菜单状态
  isOpen: boolean;
  position: { x: number; y: number };

  // 事件处理器
  onContextMenu: (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => void;
  onConnectEnd: OnConnectEnd;
  onAddNode: (nodeType: NodeType, canvasPosition: { x: number; y: number }) => void;
  onClose: () => void;
}

/**
 * ContextMenu 扩展
 * 处理右键菜单、节点添加、连接处理等逻辑
 */
export function useContextMenu(context: ContextMenuExtensionContext): ContextMenuExtensionResult {
  const { edges, setEdges, canvasRef, flowGraph, enableNodeMenu } = context;

  // 待连接的 handler 状态
  const [pendingConnectionHandle, setPendingConnectionHandle] = useState<PendingConnection | null>(null);

  // 节点菜单状态
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
  const [nodeMenuPosition, setNodeMenuPosition] = useState({ x: 0, y: 0 });

  // 处理连接结束事件
  const handleConnectEnd = useCallback<OnConnectEnd>(
    (event, state) => {
      const source = state.fromHandle?.id === 'output' ? state.fromHandle : state.toHandle?.id === 'output' ? state.toHandle : undefined;
      const target = state.fromHandle?.id === 'input' ? state.fromHandle : state.toHandle?.id === 'input' ? state.toHandle : undefined;

      if (!source && !target) {
        return;
      }

      // 如果 from 和 to 都存在，说明是正常连接，跳过
      if (source && target) {
        const params: Connection = { source: source.nodeId, target: target.nodeId, sourceHandle: source.id!, targetHandle: target.id! };
        console.log('handleConnectEnd', params);
        console.log('handleConnectEnd', edges);
        const nextEdges = addEdge(params, edges);
        console.log('handleConnectEnd nextEdges', nextEdges);
        setEdges(nextEdges);
        return;
      }

      // 获取鼠标在画布中的位置
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !('clientX' in event)) {
        return;
      }

      const canvasPosition = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      const newHandle = (source || target)!;

      setPendingConnectionHandle({ nodeId: newHandle.nodeId, handleId: newHandle.id! });

      if (enableNodeMenu) {
        setNodeMenuPosition(canvasPosition);
        setNodeMenuOpen(true);
      }
    },
    [edges, enableNodeMenu, canvasRef, setEdges],
  );

  // 右键菜单处理
  const handleContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
      if (!enableNodeMenu) return;

      event.preventDefault(); // 阻止默认右键菜单
      event.stopPropagation(); // 阻止事件冒泡

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      setNodeMenuPosition({
        x: event.clientX - rect.x,
        y: event.clientY - rect.y,
      });
      setNodeMenuOpen(true);
    },
    [enableNodeMenu, canvasRef],
  );

  // 添加节点
  const handleAddNode = useCallback(
    (nodeType: NodeType, canvasPosition: { x: number; y: number }) => {
      const newNode: FlowGraphNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: nodeType.type,
        position: flowGraph.canvasPositionToViewport(canvasPosition),
        data: {
          ...nodeType.defaultData,
          label: nodeType.label,
        },
      };

      flowGraph.reactFlowInstance.addNodes([newNode]);

      // 如果有待连接的 handler，创建连接
      if (pendingConnectionHandle) {
        console.log('handleAddNode pendingConnection', pendingConnectionHandle);
        if (pendingConnectionHandle.handleId === 'output' && pendingConnectionHandle.nodeId && pendingConnectionHandle.nodeId !== '') {
          // 从现有节点连接到新节点
          const newEdge: Connection = {
            source: pendingConnectionHandle.nodeId,
            sourceHandle: pendingConnectionHandle.handleId,
            target: newNode.id,
            targetHandle: 'input',
          };
          const nextEdges = addEdge(newEdge, edges);
          setEdges(nextEdges);
        } else if (pendingConnectionHandle.handleId === 'input' && pendingConnectionHandle.nodeId && pendingConnectionHandle.nodeId !== '') {
          // 从新节点连接到现有节点
          const newEdge: Connection = {
            source: newNode.id,
            target: pendingConnectionHandle.nodeId,
            sourceHandle: 'output',
            targetHandle: pendingConnectionHandle.handleId,
          };
          const nextEdges = addEdge(newEdge, edges);
          setEdges(nextEdges);
        }

        // 清除待连接状态
        setPendingConnectionHandle(null);
      }
    },
    [pendingConnectionHandle, edges, flowGraph, setEdges],
  );

  // 关闭节点菜单
  const handleCloseNodeMenu = useCallback(() => {
    setNodeMenuOpen(false);
    // 关闭菜单时清除待连接状态
    setPendingConnectionHandle(null);
  }, []);

  return {
    isOpen: nodeMenuOpen,
    position: nodeMenuPosition,
    onContextMenu: handleContextMenu,
    onConnectEnd: handleConnectEnd,
    onAddNode: handleAddNode,
    onClose: handleCloseNodeMenu,
  };
}
