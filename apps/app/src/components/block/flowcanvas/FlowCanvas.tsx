import { cn } from '@/lib/utils';
import { Background, Controls, Edge, MiniMap, NodeTypes, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTheme } from 'next-themes';
import React, { RefObject, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { ContextMenu, useContextMenu } from './components/ContextMenu';
import { MultiSelectToolbar, useMultiSelectToolbar } from './components/MultiSelectToolbar';
import Toolbox from './components/Toolbox';
import { FlowGraphProvider, useFlowGraphContext } from './FlowCanvasProvider';
import { useAutoLayout, useCopyPaste, useImportExport, useSchemaSync, useSelection, useWorkflowRunner } from './hooks';
import { useFlowGraph } from './hooks/useFlowGraph';
import { ExecutionResult } from './scheduler/core';
import { CanvasSchema } from './types/canvas';
import { FlowGraphNode, NodeData, NodeExecutor, NodeStatus, WorkflowNodeState } from './types/nodes';
import { GroupNode } from './components/LabeledGroup';

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
  titleBox?: React.ReactNode;
  toolbox?: React.ReactNode;
  agentPanel?: React.ReactNode;
  nodeTypes: Record<string, { component: NodeTypes[keyof NodeTypes]; processor: NodeExecutor }>; // 节点类型
}

export interface FlowCanvasRef {
  importCanvas: (canvas: string) => void;
  exportCanvas: () => string;
  run: () => Promise<ExecutionResult>;
  autoLayout: (direction?: 'TB' | 'LR') => void;
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
  titleBox,
  toolbox,
  agentPanel,
  nodeTypes,
}: FlowCanvasProps) {
  const { theme } = useTheme();
  const context = useFlowGraphContext();
  const flowGraph = useFlowGraph();
  const { exportCanvasToJson } = useImportExport();
  const selection = useSelection();
  const { autoLayout } = useAutoLayout();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialSchema?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialSchema?.edges || []);
  const workflowRunner = useWorkflowRunner({
    onSchemaChange: schema => {
      onSchemaChange?.(schema);
      setNodes(schema.nodes);
      setEdges(schema.edges);
    },
  });

  // 节点类型和执行器映射
  const nodeMap = useMemo(() => {
    const types = {} as NodeTypes;
    const executors = new Map<string, NodeExecutor>();
    Object.entries(nodeTypes).forEach(([key, value]) => {
      executors.set(key, value.processor);
      types[key] = value.component;
    });
    types.group = GroupNode;
    return { executors, types };
  }, [nodeTypes]);

  // Schema 同步：只在实质性数据变更时触发 onSchemaChange
  // 会自动过滤掉 selected, dragging 等临时 UI 状态
  useSchemaSync({ nodes, edges, onSchemaChange });

  useImperativeHandle(
    ref,
    () => ({
      importCanvas: (canvas: string) => {
        const schema = JSON.parse(canvas);
        // 使用 React Flow 实例直接更新，确保立即生效
        flowGraph.reactFlowInstance.setNodes(schema?.nodes || []);
        flowGraph.reactFlowInstance.setEdges(schema?.edges || []);
      },
      exportCanvas: () => {
        return exportCanvasToJson();
      },
      run: async () => {
        return await workflowRunner.runWorkflow({ nodes, edges }, undefined, nodeMap.executors);
      },
      autoLayout: (direction?: 'TB' | 'LR') => {
        autoLayout(direction);
      },
    }),
    [flowGraph, exportCanvasToJson, workflowRunner, autoLayout],
  );

  // 复制粘贴扩展
  const copyPasteExtension = useCopyPaste({
    nodes,
    edges,
    setNodes,
    setEdges,
    selectedNodes: selection.selectedNodes,
    canvasRef,
    flowGraph,
  });

  // 右键菜单扩展
  const contextMenuExtension = useContextMenu({
    edges,
    setEdges,
    canvasRef,
    flowGraph,
    enableNodeMenu,
  });

  // 多选工具栏扩展
  const multiSelectExtension = useMultiSelectToolbar({
    nodes,
    edges,
    selectedNodes: selection.selectedNodes,
    workflowRunner,
    nodeExecutors: nodeMap.executors,
    setNodes,
    setEdges,
  });

  const handleNodeClick = useCallback((event: React.MouseEvent<Element, MouseEvent>, node: FlowGraphNode) => {
    event.stopPropagation();
    context.setFocusedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback((event: React.MouseEvent<Element, MouseEvent>) => {
    context.setFocusedNodeId(null);
  }, []);

  return (
    <div
      className={cn(`relative h-full w-full`, className)}
      tabIndex={0} // 使画布可聚焦
      onFocus={copyPasteExtension.onCanvasFocus}
      onBlur={copyPasteExtension.onCanvasBlur}
    >
      <ReactFlow
        ref={canvasRef}
        colorMode={theme === 'dark' ? 'dark' : 'light'}
        nodes={nodes}
        edges={edges}
        onConnectEnd={contextMenuExtension.onConnectEnd}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneContextMenu={contextMenuExtension.onContextMenu}
        onSelectionChange={selection.onSelectionChange}
        onSelectionStart={selection.onSelectionStart}
        onSelectionEnd={selection.onSelectionEnd}
        onMouseMove={copyPasteExtension.onMouseMove}
        nodeTypes={nodeMap.types}
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
        onPaneClick={handlePaneClick}
        maxZoom={2}
        minZoom={0.1}
      >
        {showBackground && <Background />}
        {showControls && <Controls />}
        {showMiniMap && <MiniMap zoomable pannable />}

        {/* 标题栏 */}
        {titleBox && <Toolbox position={{ left: 10, top: 10 }}>{titleBox}</Toolbox>}
        {/* 工具栏 */}
        {toolbox && <Toolbox position={{ left: 10, top: 'calc(50% - 95px)' }}>{toolbox}</Toolbox>}
        {/* 节点菜单 */}
        {enableNodeMenu && (
          <ContextMenu
            isOpen={contextMenuExtension.isOpen}
            position={contextMenuExtension.position}
            onClose={contextMenuExtension.onClose}
            onAddNode={contextMenuExtension.onAddNode}
            canvasRef={canvasRef}
          />
        )}

        {/* 多选工具栏 */}
        <MultiSelectToolbar
          selecting={selection.selecting}
          selectedNodes={selection.selectedNodes}
          onExecuteSelectedNodes={multiSelectExtension.onExecuteSelectedNodes}
          onGroupSelectedNodes={multiSelectExtension.onGroupSelectedNodes}
          onUngroupSelectedNode={multiSelectExtension.onUngroupSelectedNode}
          onLayoutGroup={multiSelectExtension.onLayoutGroup}
        />

        {/* Agent 面板 */}
        {agentPanel}
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
