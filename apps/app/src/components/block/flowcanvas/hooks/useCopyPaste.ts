import { Edge } from '@xyflow/react';
import { useCallback, useEffect, useState } from 'react';
import { FlowGraphNode } from '../types/nodes';
import { useFlowGraph } from './useFlowGraph';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

// ==================== 常量定义 ====================

/** 剪贴板数据类型标识 */
const CLIPBOARD_TYPE = 'flowcanvas-nodes';

/** 剪贴板数据版本 */
const CLIPBOARD_VERSION = '1.0';

/** 是否启用调试日志 */
const DEBUG_ENABLED = false;

// ==================== 类型定义 ====================

/**
 * 复制粘贴扩展上下文
 */
export interface CopyPasteExtensionContext {
  /** 节点列表 */
  nodes: FlowGraphNode[];
  /** 边列表 */
  edges: Edge[];
  /** 设置节点的方法 */
  setNodes: React.Dispatch<React.SetStateAction<FlowGraphNode[]>>;
  /** 设置边的方法 */
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  /** 选中的节点ID列表 */
  selectedNodes: string[];
  /** 画布引用 */
  canvasRef: React.RefObject<HTMLElement | null>;
  /** FlowGraph工具方法 */
  flowGraph: ReturnType<typeof useFlowGraph>;
}

/**
 * 复制粘贴扩展返回值
 */
export interface CopyPasteExtensionResult {
  /** 鼠标移动事件处理器 */
  onMouseMove: (event: React.MouseEvent<Element, MouseEvent>) => void;
}

/**
 * 剪贴板数据格式
 */
interface ClipboardData {
  /** 数据类型标识 */
  type: typeof CLIPBOARD_TYPE;
  /** 数据版本 */
  version: typeof CLIPBOARD_VERSION;
  /** 节点数据 */
  nodes: FlowGraphNode[];
  /** 边数据 */
  edges: Edge[];
  /** 时间戳 */
  timestamp: number;
}

// ==================== 工具函数 ====================

/**
 * 调试日志输出
 */
function debugLog(message: string, data?: unknown): void {
  if (DEBUG_ENABLED) {
    console.log(message, data ?? '');
  }
}

/**
 * 生成唯一ID
 */
function generateUniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 检测是否为Mac平台
 */
function isMacPlatform(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

// ==================== 纯函数（业务逻辑） ====================

/**
 * 递归收集group内的所有子节点（包括嵌套的group）
 * @param groupId - group节点ID
 * @param allNodes - 所有节点列表
 * @returns 子节点列表
 */
function collectChildNodesRecursive(groupId: string, allNodes: FlowGraphNode[]): FlowGraphNode[] {
  const directChildren = allNodes.filter(node => node.parentId === groupId);
  const childNodes: FlowGraphNode[] = [...directChildren];

  // 递归收集子节点的子节点
  directChildren.forEach(child => {
    if (child.type === 'group') {
      const nestedChildren = collectChildNodesRecursive(child.id, allNodes);
      childNodes.push(...nestedChildren);
    }
  });

  return childNodes;
}

/**
 * 收集要操作的所有节点和边（包括group内的子节点）
 * @param selectedNodeIds - 选中的节点ID列表
 * @param allNodes - 所有节点列表
 * @param allEdges - 所有边列表
 * @returns 包含节点ID集合、节点列表和边列表
 */
function collectNodesToOperatePure(
  selectedNodeIds: string[],
  allNodes: FlowGraphNode[],
  allEdges: Edge[],
): {
  nodeIds: Set<string>;
  nodes: FlowGraphNode[];
  edges: Edge[];
} {
  if (selectedNodeIds.length === 0) {
    return { nodeIds: new Set(), nodes: [], edges: [] };
  }

  // 获取直接选中的节点
  const directlySelectedNodes = allNodes.filter(node => selectedNodeIds.includes(node.id));

  // 收集所有需要操作的节点ID（包括group内的子节点）
  const allNodeIds = new Set<string>(selectedNodeIds);

  // 对于每个选中的group节点，递归收集其子节点
  directlySelectedNodes.forEach(node => {
    if (node.type === 'group') {
      const childNodes = collectChildNodesRecursive(node.id, allNodes);
      childNodes.forEach(child => allNodeIds.add(child.id));
    }
  });

  // 过滤出所有需要操作的节点
  const operateNodes = allNodes.filter(node => allNodeIds.has(node.id));

  // 过滤相关的边（source和target都在操作范围内的边）
  const operateEdges = allEdges.filter(edge => allNodeIds.has(edge.source) && allNodeIds.has(edge.target));

  debugLog('=== 节点收集 ===', {
    selectedNodeIds,
    allNodeIds: Array.from(allNodeIds),
    nodeCount: operateNodes.length,
    edgeCount: operateEdges.length,
    nodeDetails: operateNodes.map(n => ({ id: n.id, type: n.type, parentId: n.parentId })),
  });

  return { nodeIds: allNodeIds, nodes: operateNodes, edges: operateEdges };
}

/**
 * 计算节点边界框的最小坐标
 * @param nodes - 节点列表
 * @returns 最小x和y坐标
 */
function calculateNodesBounds(nodes: FlowGraphNode[]): { minX: number; minY: number } {
  // 只使用顶层节点（没有parentId的节点）来计算
  // 因为子节点的position是相对于父节点的
  const topLevelNodes = nodes.filter(node => !node.parentId);
  const nodesToCalculate = topLevelNodes.length > 0 ? topLevelNodes : nodes;

  const minX = Math.min(...nodesToCalculate.map(node => node.position.x));
  const minY = Math.min(...nodesToCalculate.map(node => node.position.y));

  return { minX, minY };
}

/**
 * 计算粘贴偏移量
 * @param bounds - 节点边界框
 * @param targetPosition - 目标位置
 * @returns 偏移量
 */
function calculateOffset(bounds: { minX: number; minY: number }, targetPosition: { x: number; y: number }): { offsetX: number; offsetY: number } {
  const offsetX = targetPosition.x - bounds.minX;
  const offsetY = targetPosition.y - bounds.minY;

  debugLog('=== 粘贴位置计算 ===', {
    bounds,
    targetPosition,
    offset: { offsetX, offsetY },
  });

  return { offsetX, offsetY };
}

/**
 * 生成节点ID映射表
 * @param nodes - 节点列表
 * @param idGenerator - ID生成函数
 * @returns ID映射表
 */
function generateNodeIdMap(nodes: FlowGraphNode[], idGenerator: (prefix: string) => string = generateUniqueId): Map<string, string> {
  const idMap = new Map<string, string>();
  nodes.forEach(node => {
    const newId = idGenerator('node');
    idMap.set(node.id, newId);
  });

  debugLog('=== ID映射生成 ===', Object.fromEntries(idMap));

  return idMap;
}

/**
 * 创建粘贴的新节点
 * @param clipboardNodes - 剪贴板中的节点
 * @param idMap - ID映射表
 * @param offset - 位置偏移量
 * @returns 新节点列表
 */
function createPastedNodesPure(
  clipboardNodes: FlowGraphNode[],
  idMap: Map<string, string>,
  offset: { offsetX: number; offsetY: number },
): FlowGraphNode[] {
  return clipboardNodes.map(node => {
    // 构建基础节点
    const baseNode = {
      ...node,
      id: idMap.get(node.id)!,
      position: {
        // 只对顶层节点应用偏移，子节点保持相对坐标
        x: node.parentId ? node.position.x : node.position.x + offset.offsetX,
        y: node.parentId ? node.position.y : node.position.y + offset.offsetY,
      },
      selected: false,
    };

    // 移除旧的parentId和相关属性，避免被放到原来的组里
    delete baseNode.parentId;
    delete baseNode.extent;
    delete baseNode.expandParent;

    // 如果节点的parent也在复制范围内，则重新设置parentId和相关属性
    if (node.parentId && idMap.has(node.parentId)) {
      baseNode.parentId = idMap.get(node.parentId)!;
      baseNode.extent = 'parent' as const;
      baseNode.expandParent = true;

      debugLog(`节点 ${node.id} 的parentId从 ${node.parentId} 更新为 ${baseNode.parentId}`);
    } else if (node.parentId) {
      debugLog(`节点 ${node.id} 的parentId ${node.parentId} 不在复制范围内，将移除parentId`);
    }

    return baseNode as FlowGraphNode;
  });
}

/**
 * 创建粘贴的新边
 * @param clipboardEdges - 剪贴板中的边
 * @param idMap - ID映射表
 * @param idGenerator - ID生成函数
 * @returns 新边列表
 */
function createPastedEdgesPure(
  clipboardEdges: Edge[],
  idMap: Map<string, string>,
  idGenerator: (prefix: string) => string = generateUniqueId,
): Edge[] {
  return clipboardEdges.map(edge => ({
    ...edge,
    id: idGenerator('edge'),
    source: idMap.get(edge.source)!,
    target: idMap.get(edge.target)!,
    selected: false,
  }));
}

// ==================== 主Hook ====================

/**
 * 复制粘贴Hook
 *
 * 功能：
 * - 支持单个和多个节点的复制、剪切、粘贴
 * - 使用系统剪贴板API，支持跨画布和跨标签页操作
 * - 支持group节点及其子节点的正确复制
 * - 支持快捷键：Cmd/Ctrl + C/X/V
 */
export function useCopyPaste(context: CopyPasteExtensionContext): CopyPasteExtensionResult {
  const { nodes, edges, setNodes, setEdges, selectedNodes, canvasRef, flowGraph } = context;
  const t = useTranslations('flowcanvas.copyPaste');

  // 跟踪鼠标在画布上的位置
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // ==================== 剪贴板操作 ====================

  /**
   * 将节点和边数据写入系统剪贴板
   */
  const writeToClipboard = useCallback(
    async (nodesToCopy: FlowGraphNode[], edgesToCopy: Edge[]): Promise<void> => {
      const clipboardData: ClipboardData = {
        type: CLIPBOARD_TYPE,
        version: CLIPBOARD_VERSION,
        nodes: nodesToCopy,
        edges: edgesToCopy,
        timestamp: Date.now(),
      };

      try {
        await navigator.clipboard.writeText(JSON.stringify(clipboardData));
        toast.success(t('copySuccess'));
      } catch (error) {
        toast.error(t('copyFailed'));
      }
    },
    [t],
  );

  /**
   * 从系统剪贴板读取节点和边数据
   */
  const readFromClipboard = useCallback(async (): Promise<{ nodes: FlowGraphNode[]; edges: Edge[] } | null> => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return null;

      const data = JSON.parse(text) as ClipboardData;

      // 验证数据格式
      if (data.type !== CLIPBOARD_TYPE || !data.nodes || !data.edges) {
        toast.error(t('invalidFormat'));
        return null;
      }

      return { nodes: data.nodes, edges: data.edges };
    } catch (error) {
      toast.error(t('readFailed'));
      return null;
    }
  }, [t]);

  // ==================== Hook内部方法（调用纯函数） ====================

  /**
   * 收集要操作的所有节点和边（包括group内的子节点）
   */
  const collectNodesToOperate = useCallback((): {
    nodeIds: Set<string>;
    nodes: FlowGraphNode[];
    edges: Edge[];
  } => {
    return collectNodesToOperatePure(selectedNodes, nodes, edges);
  }, [selectedNodes, nodes, edges]);

  // ==================== 复制/剪切/粘贴操作 ====================

  /**
   * 复制选中的节点
   */
  const handleCopy = useCallback(async () => {
    const { nodes: nodesToCopy, edges: edgesToCopy } = collectNodesToOperate();
    if (nodesToCopy.length === 0) return;

    await writeToClipboard(nodesToCopy, edgesToCopy);
  }, [collectNodesToOperate, writeToClipboard]);

  /**
   * 剪切选中的节点
   */
  const handleCut = useCallback(async () => {
    const { nodeIds, nodes: nodesToCut, edges: edgesToCut } = collectNodesToOperate();
    if (nodesToCut.length === 0) return;

    // 复制到剪贴板
    await writeToClipboard(nodesToCut, edgesToCut);

    // 删除原始节点和相关的边
    setNodes(prevNodes => prevNodes.filter(node => !nodeIds.has(node.id)));
    setEdges(prevEdges => prevEdges.filter(edge => !nodeIds.has(edge.source) && !nodeIds.has(edge.target)));

    toast.success(t('cutSuccess'));
  }, [collectNodesToOperate, writeToClipboard, setNodes, setEdges, t]);

  /**
   * 计算粘贴位置的偏移量
   */
  const calculatePasteOffset = useCallback(
    (clipboardNodes: FlowGraphNode[]): { offsetX: number; offsetY: number } => {
      const bounds = calculateNodesBounds(clipboardNodes);
      const pastePosition = flowGraph.canvasPositionToViewport(mousePosition);
      return calculateOffset(bounds, pastePosition);
    },
    [flowGraph, mousePosition],
  );

  /**
   * 粘贴节点
   */
  const handlePaste = useCallback(async () => {
    // 从系统剪贴板读取数据
    const clipboard = await readFromClipboard();
    if (!clipboard || clipboard.nodes.length === 0) return;

    debugLog('=== 粘贴操作 ===', {
      nodeCount: clipboard.nodes.length,
      nodeDetails: clipboard.nodes.map(n => ({ id: n.id, type: n.type, parentId: n.parentId, position: n.position })),
    });

    // 计算粘贴位置偏移量
    const offset = calculatePasteOffset(clipboard.nodes);

    // 生成新的节点ID映射
    const idMap = generateNodeIdMap(clipboard.nodes);

    // 创建新节点和边
    const newNodes = createPastedNodesPure(clipboard.nodes, idMap, offset);
    const newEdges = createPastedEdgesPure(clipboard.edges, idMap);

    debugLog('=== 创建的新元素 ===', {
      newNodes: newNodes.map(n => ({ id: n.id, type: n.type, parentId: n.parentId, position: n.position })),
      newEdgeCount: newEdges.length,
    });

    // 添加新节点和边
    setNodes(prevNodes => [...prevNodes, ...newNodes]);
    setEdges(prevEdges => [...prevEdges, ...newEdges]);

    toast.success(t('pasteSuccess'));
  }, [readFromClipboard, calculatePasteOffset, setNodes, setEdges, t]);

  // ==================== 事件处理 ====================

  /**
   * 键盘事件处理
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const cmdOrCtrl = isMacPlatform() ? event.metaKey : event.ctrlKey;
      if (!cmdOrCtrl) return;

      const key = event.key.toLowerCase();

      // 复制 Cmd/Ctrl + C
      if (key === 'c') {
        event.preventDefault();
        void handleCopy();
        return;
      }

      // 剪切 Cmd/Ctrl + X
      if (key === 'x') {
        event.preventDefault();
        void handleCut();
        return;
      }

      // 粘贴 Cmd/Ctrl + V
      if (key === 'v') {
        event.preventDefault();
        void handlePaste();
        return;
      }
    },
    [handleCopy, handleCut, handlePaste],
  );

  /**
   * 鼠标移动事件处理，跟踪鼠标位置
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<Element, MouseEvent>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      setMousePosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    [canvasRef],
  );

  // ==================== 副作用 ====================

  /**
   * 注册键盘事件监听
   */
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // ==================== 返回值 ====================

  return {
    onMouseMove: handleMouseMove,
  };
}
