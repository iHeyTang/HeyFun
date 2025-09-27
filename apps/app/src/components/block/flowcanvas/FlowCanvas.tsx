import { cn } from '@/lib/utils';
import {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  EdgeChange,
  MiniMap,
  NodeChange,
  NodeTypes,
  OnConnectEnd,
  OnEdgesChange,
  OnNodesChange,
  OnSelectionChangeFunc,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import React, { RefObject, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ContextMenu, ContextMenuProps } from './components/ContextMenu';
import { MultiSelectToolbar } from './components/MultiSelectToolbar';
import Toolbox from './components/Toolbox';
import { FlowGraphProvider, useFlowGraphContext } from './FlowCanvasProvider';
import { useWorkflowRunner } from './hooks';
import { useFlowGraph } from './hooks/useFlowGraph';
import { ExecutionResult } from './scheduler/core';
import { CanvasSchema } from './types/canvas';
import { FlowGraphNode, NodeData, NodeExecutor, NodeStatus, WorkflowNodeState } from './types/nodes';

import '@xyflow/react/dist/style.css';

type PendingConnection = { nodeId: string; handleId: string | null };

export interface FlowCanvasProps {
  initialSchema?: CanvasSchema;
  runStatus?: Map<string, WorkflowNodeState>; // 工作流执行状态
  onSchemaChange?: (schema: CanvasSchema) => void;
  className?: string;
  showBackground?: boolean;
  showControls?: boolean;
  showMiniMap?: boolean;
  enableNodeMenu?: boolean;
  ref?: RefObject<FlowCanvasRef | null>;
  toolbox?: React.ReactNode;
  nodeTypes: Record<string, { component: NodeTypes[keyof NodeTypes]; processor: NodeExecutor }>; // 节点类型
}

export interface FlowCanvasRef {
  importCanvas: (canvas: string) => void;
  exportCanvas: () => string;
  run: () => Promise<ExecutionResult>;
}

function FlowCanvasCore({
  initialSchema,
  onSchemaChange,
  className = '',
  showBackground = true,
  showControls = true,
  showMiniMap = true,
  enableNodeMenu = true,
  ref,
  toolbox,
  nodeTypes,
}: FlowCanvasProps) {
  const componentNodes = useMemo(() => {
    const types = {} as NodeTypes;
    Object.entries(nodeTypes).forEach(([key, value]) => {
      types[key] = value.component;
    });
    return types;
  }, [nodeTypes]);

  const nodeExecutors = useMemo(() => {
    const executors = new Map<string, NodeExecutor>();
    Object.entries(nodeTypes).forEach(([key, value]) => {
      executors.set(key, value.processor);
    });
    return executors;
  }, [nodeTypes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialSchema?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialSchema?.edges || []);
  const handleNodesChange = useCallback<OnNodesChange<FlowGraphNode>>(
    (changes: NodeChange<FlowGraphNode>[]) => {
      onNodesChange(changes);
    },
    [onNodesChange],
  );
  const handleEdgesChange = useCallback<OnEdgesChange<Edge>>(
    (changes: EdgeChange<Edge>[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  useEffect(() => {
    onSchemaChange?.({ nodes, edges });
  }, [nodes, edges, onSchemaChange]);

  const flowGraph = useFlowGraph();

  const handleNodeOutputChange = useCallback(
    (nodeId: string, output: NodeData['output']) => {
      // 这个函数会被缓存，导致在异步执行请求的过程中，nodes和edges发生的变化无法通过 useNodesState 和 useEdgesState 更新
      // 所以需要手动获取最新的nodes和edges
      const nodes = flowGraph.getAllNodes();
      const edges = flowGraph.getAllEdges();
      setNodes(nodes.map(node => (node.id === nodeId ? { ...node, data: { ...node.data, output } } : node)));
      onSchemaChange?.({ nodes, edges });
    },
    [flowGraph, onSchemaChange],
  );

  const workflowRunner = useWorkflowRunner({ onNodeOutputChange: handleNodeOutputChange });

  // 待连接的 handler 状态
  const [pendingConnectionHandle, setPendingConnectionHandle] = useState<PendingConnection | null>(null);

  useImperativeHandle(ref, () => ({
    importCanvas: (canvas: string) => {
      const schema = JSON.parse(canvas);
      setNodes(schema?.nodes || []);
      setEdges(schema?.edges || []);
    },
    exportCanvas: () => {
      return flowGraph.exportCanvas();
    },
    run: async () => {
      return await workflowRunner.runWorkflow({ nodes, edges }, undefined, nodeExecutors);
    },
  }));

  // 多选状态
  const [selecting, setSelecting] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const handleSelectionChange = useCallback<OnSelectionChangeFunc<FlowGraphNode, Edge>>(
    ({ nodes, edges }: { nodes: FlowGraphNode[]; edges: Edge[] }) => {
      setSelectedNodes(nodes.map(node => node.id));
      setSelectedEdges(edges.map(edge => edge.id));
    },
    [],
  );

  const canvasRef = useRef<HTMLDivElement>(null);

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
    [edges, enableNodeMenu],
  );

  // 节点菜单状态

  const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
  const [nodeMenuPosition, setNodeMenuPosition] = useState({ x: 0, y: 0 });
  const handleContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
      if (!enableNodeMenu) return;

      event.preventDefault(); // 阻止默认右键菜单
      event.stopPropagation(); // 阻止事件冒泡

      setNodeMenuPosition({
        x: event.clientX - canvasRef.current!.getBoundingClientRect().x,
        y: event.clientY - canvasRef.current!.getBoundingClientRect().y,
      });
      setNodeMenuOpen(true);
    },
    [enableNodeMenu, canvasRef],
  );

  // 添加节点
  const handleAddNode = useCallback<ContextMenuProps['onAddNode']>(
    (nodeType, canvasPosition) => {
      const newNode: FlowGraphNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: nodeType.type,
        position: flowGraph.canvasPositionToViewport(canvasPosition),
        data: {
          ...nodeType.defaultData,
          label: nodeType.label,
        },
      };

      flowGraph.addNode(newNode);
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
    [pendingConnectionHandle, edges, flowGraph],
  );

  // 关闭节点菜单
  const handleCloseNodeMenu = useCallback(() => {
    setNodeMenuOpen(false);
    // 关闭菜单时清除待连接状态
    setPendingConnectionHandle(null);
  }, []);

  // 使用Context管理节点状态
  const { setFocusedNodeId } = useFlowGraphContext();
  const handleNodeClick = useCallback((event: React.MouseEvent<Element, MouseEvent>, node: FlowGraphNode) => {
    event.stopPropagation();
    setFocusedNodeId(node.id);
  }, []);

  const handleClick = useCallback((event: React.MouseEvent<Element, MouseEvent>) => {
    setFocusedNodeId(null);
  }, []);

  const handleSelectionStart = useCallback((event: React.MouseEvent<Element, MouseEvent>) => {
    setSelecting(true);
  }, []);

  const handleSelectionEnd = useCallback((event: React.MouseEvent<Element, MouseEvent>) => {
    setSelecting(false);
  }, []);

  const handleExecuteSelectedNodes = useCallback(
    async (selectedNodeIds: string[]) => {
      console.log('FlowCanvas: 使用工作流执行器执行选中的节点', selectedNodeIds);

      if (!nodes || !edges) {
        console.error('没有可用的工作流 schema');
        return;
      }

      try {
        // 找到选中节点及其所有前置依赖节点
        const nodesToInclude = new Set<string>();
        const edgesToExecute = new Set<string>();

        // 添加选中的节点
        selectedNodeIds.forEach(nodeId => {
          nodesToInclude.add(nodeId);
        });

        // 找到所有前置依赖节点（只查找第一层）
        const findDependencies = (nodeId: string) => {
          edges?.forEach(edge => {
            if (edge.target === nodeId && !nodesToInclude.has(edge.source)) {
              nodesToInclude.add(edge.source);
              edgesToExecute.add(edge.id);
              // 只查找第一层依赖，不递归
            }
          });
        };

        // 为每个选中节点查找前置依赖
        selectedNodeIds.forEach(findDependencies);

        // 添加选中节点之间的边
        edges?.forEach(edge => {
          if (nodesToInclude.has(edge.source) && nodesToInclude.has(edge.target)) {
            edgesToExecute.add(edge.id);
          }
        });

        // 创建子工作流 schema
        const subWorkflowSchema = {
          nodes: nodes
            .filter(node => nodesToInclude.has(node.id))
            .map(node => {
              // 如果是前置依赖节点（不是选中的节点），标记为已完成状态
              if (!selectedNodeIds.includes(node.id)) {
                return { ...node, data: { ...node.data, input: new Map(), actionData: {} } };
              }
              return node;
            }),
          edges: edges.filter(edge => edgesToExecute.has(edge.id)),
          updatedAt: Date.now(),
        };

        // 使用工作流执行器运行子工作流
        // 前置依赖节点被标记为已完成状态，不会被执行，但可以提供输出数据
        // 只有选中的节点会被实际执行
        await workflowRunner.runWorkflow(subWorkflowSchema, undefined, nodeExecutors);
      } catch (error) {
        console.error('执行选中节点时出错:', error);
      }
    },
    [nodes, edges, workflowRunner, nodeExecutors],
  );

  return (
    <div className={cn(`relative h-full w-full`, className)}>
      <ReactFlow
        ref={canvasRef}
        colorMode="light"
        nodes={nodes}
        edges={edges}
        onConnectEnd={handleConnectEnd}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onPaneContextMenu={handleContextMenu}
        onSelectionChange={handleSelectionChange}
        onSelectionStart={handleSelectionStart}
        onSelectionEnd={handleSelectionEnd}
        nodeTypes={componentNodes}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        panOnDrag={false} // 只有按下空格键时允许拖拽平移
        selectNodesOnDrag={false} // 空格键未按下时允许多选
        selectionOnDrag={true} // 空格键未按下时允许框选
        panOnScroll={true}
        zoomOnScroll={true}
        fitView
        onNodeClick={handleNodeClick}
        onClick={handleClick}
      >
        {showBackground && <Background />}
        {showControls && <Controls />}
        {showMiniMap && <MiniMap zoomable pannable />}

        {/* 工具栏 */}
        {toolbox && <Toolbox>{toolbox}</Toolbox>}
        {/* 节点菜单 */}
        {enableNodeMenu && <ContextMenu isOpen={nodeMenuOpen} position={nodeMenuPosition} onClose={handleCloseNodeMenu} onAddNode={handleAddNode} />}

        {/* 多选工具栏 */}
        <MultiSelectToolbar selecting={selecting} selectedNodes={selectedNodes} onExecuteSelectedNodes={handleExecuteSelectedNodes} />
      </ReactFlow>
    </div>
  );
}

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowGraphProvider>
        <FlowCanvasCore {...props} />
      </FlowGraphProvider>
    </ReactFlowProvider>
  );
}

// 工作流执行相关的类型定义
export interface WorkflowExecutionContext {
  nodeStates: Map<string, WorkflowNodeState>;
  canvasSchema: CanvasSchema;
  onNodeProcess?: (nodeId: string, nodeData: NodeData) => Promise<void>;
  onStatusChange?: (runStatus: Map<string, WorkflowNodeState>) => void;
}

// 创建工作流执行上下文的辅助函数
export const createWorkflowContext = (
  nodes: FlowGraphNode[],
  edges: Edge[],
  onNodeProcess?: (nodeId: string, nodeData: NodeData) => Promise<void>,
  onStatusChange?: (runStatus: Map<string, WorkflowNodeState>) => void,
): WorkflowExecutionContext => {
  const nodeStates = new Map<string, WorkflowNodeState>();

  // 初始化节点状态
  nodes.forEach(node => {
    const enhancedData = node.data as NodeData;
    nodeStates.set(node.id, {
      id: node.id,
      status: NodeStatus.IDLE, // 默认状态
      auto: enhancedData.auto !== false,
    });
  });

  return {
    nodeStates,
    canvasSchema: { nodes, edges },
    onNodeProcess,
    onStatusChange,
  };
};
