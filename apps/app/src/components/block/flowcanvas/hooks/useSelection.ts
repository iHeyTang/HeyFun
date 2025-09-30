import { Edge, OnSelectionChangeFunc } from '@xyflow/react';
import { useCallback, useState } from 'react';
import { FlowGraphNode } from '../types/nodes';

/**
 * 选择状态
 */
export interface SelectionState {
  // 是否正在选择（框选状态）
  selecting: boolean;
  // 选中的节点 ID 列表
  selectedNodes: string[];
  // 选中的边 ID 列表
  selectedEdges: string[];
}

/**
 * 选择操作
 */
export interface SelectionActions {
  // 选择变化处理器
  onSelectionChange: OnSelectionChangeFunc<FlowGraphNode, Edge>;
  // 开始选择
  onSelectionStart: (event: React.MouseEvent<Element, MouseEvent>) => void;
  // 结束选择
  onSelectionEnd: (event: React.MouseEvent<Element, MouseEvent>) => void;
}

/**
 * 选择 Hook 返回值
 */
export interface UseSelectionResult extends SelectionState, SelectionActions {}

/**
 * 选择管理 Hook
 * 管理节点和边的选择状态，是全局共享的 Hook
 */
export function useSelection(): UseSelectionResult {
  // 多选状态
  const [selecting, setSelecting] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);

  // 选择变化处理
  const handleSelectionChange = useCallback<OnSelectionChangeFunc<FlowGraphNode, Edge>>(
    ({ nodes, edges }: { nodes: FlowGraphNode[]; edges: Edge[] }) => {
      setSelectedNodes(nodes.map(node => node.id));
      setSelectedEdges(edges.map(edge => edge.id));
    },
    [],
  );

  // 开始选择
  const handleSelectionStart = useCallback((event: React.MouseEvent<Element, MouseEvent>) => {
    setSelecting(true);
  }, []);

  // 结束选择
  const handleSelectionEnd = useCallback((event: React.MouseEvent<Element, MouseEvent>) => {
    setSelecting(false);
  }, []);

  return {
    selecting,
    selectedNodes,
    selectedEdges,
    onSelectionChange: handleSelectionChange,
    onSelectionStart: handleSelectionStart,
    onSelectionEnd: handleSelectionEnd,
  };
}
