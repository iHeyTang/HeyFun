import dagre from 'dagre';
import { Edge } from '@xyflow/react';
import { FlowGraphNode } from '../types/nodes';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

/**
 * 获取节点的实际尺寸（基于节点类型和数据估算）
 */
const getNodeDimensions = (node: FlowGraphNode): { width: number; height: number } => {
  // 基础尺寸
  const baseWidth = 400;
  const baseHeight = 180;

  // 根据节点类型调整尺寸
  switch (node.type) {
    case 'text':
      return { width: 350, height: 150 };
    case 'image':
    case 'video':
      return { width: 420, height: 220 };
    case 'audio':
    case 'music':
      return { width: 400, height: 200 };
    default:
      return { width: baseWidth, height: baseHeight };
  }
};

/**
 * 检测连通分量（使用并查集算法）
 */
const findConnectedComponents = (nodes: FlowGraphNode[], edges: Edge[]): FlowGraphNode[][] => {
  const nodeMap = new Map<string, FlowGraphNode>();
  nodes.forEach(node => nodeMap.set(node.id, node));

  // 并查集
  const parent = new Map<string, string>();
  nodes.forEach(node => parent.set(node.id, node.id));

  const find = (id: string): string => {
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!));
    }
    return parent.get(id)!;
  };

  const union = (id1: string, id2: string) => {
    const root1 = find(id1);
    const root2 = find(id2);
    if (root1 !== root2) {
      parent.set(root1, root2);
    }
  };

  // 合并有连接的节点
  edges.forEach(edge => {
    union(edge.source, edge.target);
  });

  // 分组
  const components = new Map<string, FlowGraphNode[]>();
  nodes.forEach(node => {
    const root = find(node.id);
    if (!components.has(root)) {
      components.set(root, []);
    }
    components.get(root)!.push(node);
  });

  return Array.from(components.values());
};

/**
 * 使用 Dagre 算法对节点进行自动布局
 * @param nodes - 节点数组
 * @param edges - 边数组
 * @param direction - 布局方向: 'TB' (从上到下) 或 'LR' (从左到右)
 * @returns 布局后的节点和边
 */
export const getLayoutedElements = (nodes: FlowGraphNode[], edges: Edge[], direction: 'TB' | 'LR' = 'TB') => {
  // 检测连通分量
  const components = findConnectedComponents(nodes, edges);

  // 分离孤立节点（单节点组）和连通组
  const isolatedNodes = components.filter(comp => comp.length === 1).flat();
  const connectedGroups = components.filter(comp => comp.length > 1);

  // 为每个连通组分别布局（组始终垂直排列）
  const groupSpacing = 150; // 组与组之间的间距
  let currentYOffset = 0; // 当前组的垂直偏移量
  let maxWidth = 0; // 所有组的最大宽度

  const layoutedConnectedNodes: FlowGraphNode[] = [];

  connectedGroups.forEach((groupNodes, groupIndex) => {
    // 为每个组创建一个新的 dagre 图
    const groupGraph = new dagre.graphlib.Graph();
    groupGraph.setDefaultEdgeLabel(() => ({}));
    groupGraph.setGraph({
      rankdir: direction,
      nodesep: direction === 'LR' ? 10 : 5,
      ranksep: direction === 'LR' ? 20 : 10,
      marginx: 30,
      marginy: 30,
      align: undefined,
      edgesep: 20,
    });

    // 添加组内节点
    groupNodes.forEach(node => {
      const dimensions = getNodeDimensions(node);
      groupGraph.setNode(node.id, {
        width: dimensions.width,
        height: dimensions.height,
      });
    });

    // 添加组内的边
    const groupNodeIds = new Set(groupNodes.map(n => n.id));
    edges.forEach(edge => {
      if (groupNodeIds.has(edge.source) && groupNodeIds.has(edge.target)) {
        groupGraph.setEdge(edge.source, edge.target);
      }
    });

    // 计算组的布局
    dagre.layout(groupGraph);

    const graph = groupGraph.graph();
    const groupWidth = graph.width || 0;
    const groupHeight = graph.height || 0;

    // 更新组内节点位置（组始终垂直排列，从上到下）
    groupNodes.forEach(node => {
      const nodeWithPosition = groupGraph.node(node.id);
      const dimensions = getNodeDimensions(node);

      const x = nodeWithPosition.x - dimensions.width / 2;
      const y = currentYOffset + nodeWithPosition.y - dimensions.height / 2;

      layoutedConnectedNodes.push({
        ...node,
        position: { x, y },
      });
    });

    // 更新偏移量以便下一个组（垂直堆叠）
    currentYOffset += groupHeight + groupSpacing;
    maxWidth = Math.max(maxWidth, groupWidth);
  });

  // 计算最终的图边界（用于放置孤立节点）
  const totalWidth = maxWidth;
  const totalHeight = currentYOffset;

  // 布局孤立节点：放置在所有组的右侧，垂直排列
  const spacing = 50; // 孤立节点之间的间距
  let currentOffset = 0; // 累积偏移量

  const layoutedIsolatedNodes = isolatedNodes.map((node, index) => {
    const dimensions = getNodeDimensions(node);

    // 孤立节点始终放在右侧，垂直排列
    const x = totalWidth + 100;
    const y = 30 + currentOffset;
    currentOffset += dimensions.height + spacing; // 累加当前节点高度和间距

    return {
      ...node,
      position: { x, y },
    };
  });

  return { nodes: [...layoutedConnectedNodes, ...layoutedIsolatedNodes], edges };
};
