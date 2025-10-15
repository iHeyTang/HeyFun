import { Edge } from '@xyflow/react';
import { useCallback, useEffect, useState } from 'react';
import { FlowGraphNode } from '../types/nodes';
import { useFlowGraph } from './useFlowGraph';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

/**
 * 复制粘贴扩展上下文
 */
export interface CopyPasteExtensionContext {
  // 节点和边的状态
  nodes: FlowGraphNode[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<FlowGraphNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;

  // 选中状态
  selectedNodes: string[];

  // 画布引用
  canvasRef: React.RefObject<HTMLElement | null>;

  // 工具方法
  flowGraph: ReturnType<typeof useFlowGraph>;
}

/**
 * 复制粘贴扩展返回值
 */
export interface CopyPasteExtensionResult {
  /**
   * 鼠标移动事件处理器
   */
  onMouseMove: (event: React.MouseEvent<Element, MouseEvent>) => void;
}

/**
 * 剪贴板数据格式
 */
interface ClipboardData {
  type: 'flowcanvas-nodes'; // 标识符，用于识别我们的数据格式
  version: '1.0';
  nodes: FlowGraphNode[];
  edges: Edge[];
  timestamp: number;
}

/**
 * 复制粘贴扩展
 * 提供节点的复制粘贴功能，支持单个和多个节点
 * 使用系统剪贴板 API，支持跨画布和跨标签页复制粘贴
 */
export function useCopyPaste(context: CopyPasteExtensionContext): CopyPasteExtensionResult {
  const { nodes, edges, setNodes, setEdges, selectedNodes, canvasRef, flowGraph } = context;
  const t = useTranslations('flowcanvas.copyPaste');

  // 跟踪鼠标在画布上的位置
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  /**
   * 将节点和边数据写入系统剪贴板
   */
  const writeToClipboard = useCallback(
    async (nodesToCopy: FlowGraphNode[], edgesToCopy: Edge[]) => {
      const clipboardData: ClipboardData = {
        type: 'flowcanvas-nodes',
        version: '1.0',
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
      if (data.type !== 'flowcanvas-nodes' || !data.nodes || !data.edges) {
        toast.error(t('invalidFormat'));
        return null;
      }

      return { nodes: data.nodes, edges: data.edges };
    } catch (error) {
      toast.error(t('readFailed'));
      return null;
    }
  }, [t]);

  // 复制选中的节点
  const handleCopy = useCallback(async () => {
    if (selectedNodes.length === 0) return;

    const nodesToCopy = nodes.filter(node => selectedNodes.includes(node.id));
    const edgesToCopy = edges.filter(edge => selectedNodes.includes(edge.source) && selectedNodes.includes(edge.target));

    await writeToClipboard(nodesToCopy, edgesToCopy);
  }, [selectedNodes, nodes, edges, writeToClipboard]);

  // 剪切选中的节点
  const handleCut = useCallback(async () => {
    if (selectedNodes.length === 0) return;

    const nodesToCut = nodes.filter(node => selectedNodes.includes(node.id));
    const edgesToCut = edges.filter(edge => selectedNodes.includes(edge.source) && selectedNodes.includes(edge.target));

    // 复制到剪贴板
    await writeToClipboard(nodesToCut, edgesToCut);

    // 删除原始节点和相关的边
    setNodes(prevNodes => prevNodes.filter(node => !selectedNodes.includes(node.id)));
    setEdges(prevEdges => prevEdges.filter(edge => !selectedNodes.includes(edge.source) && !selectedNodes.includes(edge.target)));

    toast.success(t('cutSuccess'));
  }, [selectedNodes, nodes, edges, writeToClipboard, setNodes, setEdges, t]);

  // 粘贴节点
  const handlePaste = useCallback(async () => {
    // 从系统剪贴板读取数据
    const clipboard = await readFromClipboard();
    if (!clipboard || clipboard.nodes.length === 0) return;

    // 找到所有节点的最小x和y坐标（左上角）
    const minX = Math.min(...clipboard.nodes.map(node => node.position.x));
    const minY = Math.min(...clipboard.nodes.map(node => node.position.y));

    // 将画布坐标转换为视口坐标
    const pastePosition = flowGraph.canvasPositionToViewport(mousePosition);

    // 计算偏移量，使左上角对齐到鼠标位置
    const offsetX = pastePosition.x - minX;
    const offsetY = pastePosition.y - minY;

    // 生成新的节点ID映射
    const idMap = new Map<string, string>();
    clipboard.nodes.forEach(node => {
      const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      idMap.set(node.id, newId);
    });

    // 创建新节点，粘贴到鼠标位置（保持相对位置）
    const newNodes: FlowGraphNode[] = clipboard.nodes.map(node => ({
      ...node,
      id: idMap.get(node.id)!,
      position: {
        x: node.position.x + offsetX,
        y: node.position.y + offsetY,
      },
      selected: false,
    }));

    // 创建新边，使用新的节点ID
    const newEdges: Edge[] = clipboard.edges.map(edge => ({
      ...edge,
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
      selected: false,
    }));

    // 添加新节点和边
    setNodes(prevNodes => [...prevNodes, ...newNodes]);
    setEdges(prevEdges => [...prevEdges, ...newEdges]);

    toast.success(t('pasteSuccess'));
  }, [readFromClipboard, mousePosition, flowGraph, setNodes, setEdges, t]);

  // 键盘事件处理
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 检查是否是 Cmd/Ctrl 组合键
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      if (!cmdOrCtrl) return;

      // 复制 Cmd/Ctrl + C
      if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        void handleCopy();
      }

      // 剪切 Cmd/Ctrl + X
      if (event.key === 'x' || event.key === 'X') {
        event.preventDefault();
        void handleCut();
      }

      // 粘贴 Cmd/Ctrl + V
      if (event.key === 'v' || event.key === 'V') {
        event.preventDefault();
        void handlePaste();
      }
    },
    [handleCopy, handleCut, handlePaste],
  );

  // 跟踪鼠标位置
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

  // 注册键盘事件监听
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    onMouseMove: handleMouseMove,
  };
}
