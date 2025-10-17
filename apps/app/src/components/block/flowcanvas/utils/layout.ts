import dagre from 'dagre';
import { Edge } from '@xyflow/react';
import { FlowGraphNode } from '../types/nodes';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

/**
 * 获取节点的实际尺寸（基于节点类型和数据估算）
 */
const getNodeDimensions = (node: FlowGraphNode): { width: number; height: number } => {
  // 如果节点有明确的尺寸（如 group 或已渲染的节点），直接使用
  if (node.width && node.height) {
    return { width: node.width, height: node.height };
  }

  // 根据节点类型使用默认尺寸
  switch (node.type) {
    case 'group':
      return { width: 400, height: 300 };
    case 'text':
      return { width: 350, height: 150 };
    case 'image':
    case 'video':
      return { width: 420, height: 220 };
    case 'audio':
    case 'music':
      return { width: 400, height: 200 };
    default:
      return { width: 400, height: 180 };
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
 * 获取节点的层级深度（用于嵌套 group）
 */
const getNodeDepth = (nodeId: string, nodes: FlowGraphNode[]): number => {
  const node = nodes.find(n => n.id === nodeId);
  if (!node || !node.parentId) {
    return 0;
  }
  return 1 + getNodeDepth(node.parentId, nodes);
};

/**
 * 为 group 内的子节点进行布局
 *
 * 关键点：
 * 1. 检测连通分量，分别布局连通节点和孤立节点
 * 2. 使用 dagre 对子节点进行布局
 * 3. 规范化子节点位置，确保从 (padding, padding) 开始
 * 4. 根据子节点实际位置计算 group 的精确边界
 */
const layoutGroupChildren = (
  groupNode: FlowGraphNode,
  childNodes: FlowGraphNode[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
): { children: FlowGraphNode[]; bounds: { width: number; height: number } } => {
  if (childNodes.length === 0) {
    return { children: [], bounds: { width: 300, height: 200 } };
  }

  const padding = 60; // group 的内边距
  const nodeSpacing = 120; // 节点之间的间距
  const componentSpacing = 150; // 连通组之间的间距

  // 检测子节点的连通分量
  const components = findConnectedComponents(childNodes, edges);

  // 分离孤立节点（单节点组）和连通组
  const isolatedNodes = components.filter(comp => comp.length === 1).flat();
  const connectedGroups = components.filter(comp => comp.length > 1);

  let allLayoutChildren: FlowGraphNode[] = [];
  let currentX = padding;
  let currentY = padding;
  let maxWidth = 0;

  // 布局连通组
  if (connectedGroups.length > 0) {
    connectedGroups.forEach((groupNodes, groupIndex) => {
      // 创建 dagre 图用于布局这个连通组
      const childGraph = new dagre.graphlib.Graph();
      childGraph.setDefaultEdgeLabel(() => ({}));
      childGraph.setGraph({
        rankdir: direction,
        nodesep: direction === 'LR' ? 120 : 100, // 增加节点间距
        ranksep: direction === 'LR' ? 180 : 150, // 增加层级间距
        marginx: 0,
        marginy: 0,
        align: undefined,
        edgesep: 40,
      });

      // 添加节点
      groupNodes.forEach(node => {
        const dimensions = getNodeDimensions(node);
        childGraph.setNode(node.id, {
          width: dimensions.width,
          height: dimensions.height,
        });
      });

      // 添加这个连通组内的边
      const groupNodeIds = new Set(groupNodes.map(n => n.id));
      edges.forEach(edge => {
        if (groupNodeIds.has(edge.source) && groupNodeIds.has(edge.target)) {
          childGraph.setEdge(edge.source, edge.target);
        }
      });

      // 计算布局
      dagre.layout(childGraph);

      // 获取布局后的尺寸
      const graph = childGraph.graph();
      const groupWidth = graph.width || 0;
      const groupHeight = graph.height || 0;

      // 获取所有节点的 dagre 布局位置
      const dagrePositions = groupNodes.map(node => {
        const nodeWithPosition = childGraph.node(node.id);
        const dimensions = getNodeDimensions(node);

        return {
          node,
          dimensions,
          x: nodeWithPosition.x - dimensions.width / 2,
          y: nodeWithPosition.y - dimensions.height / 2,
        };
      });

      // 找到 dagre 布局的最小坐标
      const minDagreX = Math.min(...dagrePositions.map(p => p.x));
      const minDagreY = Math.min(...dagrePositions.map(p => p.y));

      // 规范化位置并应用偏移
      const layoutChildren = dagrePositions.map(({ node, x, y }) => {
        return {
          ...node,
          position: {
            x: x - minDagreX + currentX,
            y: y - minDagreY + currentY,
          },
          parentId: groupNode.id,
        };
      });

      allLayoutChildren.push(...layoutChildren);

      // 对于TB布局，所有内容都竖着排列
      currentY += groupHeight + componentSpacing;
      maxWidth = Math.max(maxWidth, groupWidth);
    });
  }

  // 布局孤立节点（包括孤立的 group 节点）- 继续竖着排列
  if (isolatedNodes.length > 0) {
    isolatedNodes.forEach(node => {
      const dimensions = getNodeDimensions(node);

      allLayoutChildren.push({
        ...node,
        position: {
          x: currentX,
          y: currentY,
        },
        parentId: groupNode.id,
      });

      // 继续竖着排列
      currentY += dimensions.height + nodeSpacing;
      maxWidth = Math.max(maxWidth, dimensions.width);
    });
  }

  // 计算子节点的实际边界
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  allLayoutChildren.forEach(child => {
    const dimensions = getNodeDimensions(child);

    const childMinX = child.position.x;
    const childMinY = child.position.y;
    const childMaxX = child.position.x + dimensions.width;
    const childMaxY = child.position.y + dimensions.height;

    minX = Math.min(minX, childMinX);
    minY = Math.min(minY, childMinY);
    maxX = Math.max(maxX, childMaxX);
    maxY = Math.max(maxY, childMaxY);
  });

  // Group 的最终尺寸
  const finalWidth = Math.max(maxX + padding, 300);
  const finalHeight = Math.max(maxY + padding, 200);

  return {
    children: allLayoutChildren,
    bounds: {
      width: finalWidth,
      height: finalHeight,
    },
  };
};

/**
 * 单独为某个 group 做布局（用于 group toolbar）
 * @param groupId - group 节点的 ID
 * @param nodes - 所有节点数组
 * @param edges - 所有边数组
 * @param direction - 布局方向
 * @returns 更新后的节点数组
 */
export const layoutGroup = (groupId: string, nodes: FlowGraphNode[], edges: Edge[], direction: 'TB' | 'LR' = 'TB'): FlowGraphNode[] => {
  const groupNode = nodes.find(n => n.id === groupId);
  if (!groupNode || groupNode.type !== 'group') {
    console.warn(`Group node ${groupId} not found or not a group`);
    return nodes;
  }

  // 找到该 group 的所有直接子节点
  const directChildren = nodes.filter(n => n.parentId === groupId);
  if (directChildren.length === 0) {
    return nodes;
  }

  // 如果子节点中包含 group，先递归布局这些嵌套的 group
  const childGroupNodes = directChildren.filter(n => n.type === 'group');
  let updatedNodes = [...nodes];

  // 递归布局嵌套的 group
  for (const childGroup of childGroupNodes) {
    updatedNodes = layoutGroup(childGroup.id, updatedNodes, edges, direction);
  }

  // 获取更新后的子节点和 group 节点
  const updatedDirectChildren = updatedNodes.filter(n => n.parentId === groupId);
  const updatedGroupNode = updatedNodes.find(n => n.id === groupId)!;

  // 布局子节点
  const { children: layoutChildren, bounds } = layoutGroupChildren(updatedGroupNode, updatedDirectChildren, edges, direction);

  // 更新 group 节点的尺寸（同时更新 style 和顶级属性）
  const updatedGroup = {
    ...updatedGroupNode,
    width: bounds.width,
    height: bounds.height,
    style: {
      ...updatedGroupNode.style,
      width: bounds.width,
      height: bounds.height,
    },
  };

  // 构建新的节点数组
  const nodeMap = new Map(updatedNodes.map(n => [n.id, n]));

  // 更新 group 节点
  nodeMap.set(groupId, updatedGroup);

  // 更新所有子节点
  layoutChildren.forEach(child => {
    nodeMap.set(child.id, child);
  });

  return Array.from(nodeMap.values());
};

/**
 * 使用 Dagre 算法对节点进行自动布局
 * @param nodes - 节点数组
 * @param edges - 边数组
 * @param direction - 布局方向: 'TB' (从上到下) 或 'LR' (从左到右)
 * @returns 布局后的节点和边
 */
export const getLayoutElements = (nodes: FlowGraphNode[], edges: Edge[], direction: 'TB' | 'LR' = 'TB') => {
  // 分离 group 节点和普通节点
  const groupNodes = nodes.filter(node => node.type === 'group');
  const nonGroupNodes = nodes.filter(node => node.type !== 'group');

  // 分离顶层节点（没有 parentId）和子节点（有 parentId）
  const topLevelNodes = nonGroupNodes.filter(node => !node.parentId);

  // 按 parentId 分组所有节点（包括 group 节点，因为 group 也可以是子节点）
  const allNodesWithParent = [...groupNodes, ...nonGroupNodes].filter(n => n.parentId);
  const childNodesMap = new Map<string, FlowGraphNode[]>();

  allNodesWithParent.forEach(node => {
    if (node.parentId) {
      if (!childNodesMap.has(node.parentId)) {
        childNodesMap.set(node.parentId, []);
      }
      childNodesMap.get(node.parentId)!.push(node);
    }
  });

  // 按深度排序 group（从深到浅），以支持嵌套
  const groupsWithDepth = groupNodes.map(g => ({
    node: g,
    depth: getNodeDepth(g.id, nodes),
  }));
  groupsWithDepth.sort((a, b) => b.depth - a.depth); // 深度大的在前（从内到外）

  // 存储所有已布局的节点
  const layoutChildNodes: FlowGraphNode[] = [];
  const updatedGroupNodes: FlowGraphNode[] = [];

  // 从最深的 group 开始，逐层向上布局
  groupsWithDepth.forEach(({ node: groupNode }) => {
    const children = childNodesMap.get(groupNode.id) || [];

    // 对于嵌套的 group，使用已经更新过尺寸和位置的版本
    const updatedChildren = children.map(child => {
      if (child.type === 'group') {
        const updated = updatedGroupNodes.find(g => g.id === child.id);
        return updated || child;
      }
      // 对于普通子节点，也尝试从已布局的节点中获取
      const layouted = layoutChildNodes.find(n => n.id === child.id);
      return layouted || child;
    });

    const { children: layoutChildren, bounds } = layoutGroupChildren(groupNode, updatedChildren, edges, direction);

    // 更新或添加布局后的子节点
    layoutChildren.forEach(child => {
      // 移除旧的同ID节点
      const existingIndex = layoutChildNodes.findIndex(n => n.id === child.id);
      if (existingIndex >= 0) {
        layoutChildNodes.splice(existingIndex, 1);
      }
      layoutChildNodes.push(child);

      // 如果子节点是 group，也更新 updatedGroupNodes 中的位置
      if (child.type === 'group') {
        const groupIndex = updatedGroupNodes.findIndex(g => g.id === child.id);
        if (groupIndex >= 0) {
          const existingGroup = updatedGroupNodes[groupIndex];
          updatedGroupNodes[groupIndex] = {
            ...existingGroup,
            position: child.position,
          } as FlowGraphNode;
        }
      }
    });

    // 更新 group 节点的尺寸（同时更新 style 和顶级属性）
    const updatedGroup = {
      ...groupNode,
      width: bounds.width,
      height: bounds.height,
      style: {
        ...groupNode.style,
        width: bounds.width,
        height: bounds.height,
      },
    };

    updatedGroupNodes.push(updatedGroup);
  });

  // 现在布局顶层节点和顶层 group 节点
  // 将组节点单独处理，不和其他节点混在一起
  const topLevelGroups = updatedGroupNodes.filter(g => !g.parentId);

  // 只对顶层普通节点进行连通分量检测（不包括组节点）
  const components = findConnectedComponents(topLevelNodes, edges);

  // 分离孤立节点（单节点组）和连通组
  const isolatedNodes = components.filter(comp => comp.length === 1).flat();
  const connectedGroups = components.filter(comp => comp.length > 1);

  // 为每个连通组分别布局
  const groupSpacing = 30;
  const groupNodeSpacing = 200; // 组节点和其他节点之间的间隙
  let currentYOffset = 0;
  let maxWidth = 0;

  const layoutConnectedNodes: FlowGraphNode[] = [];

  connectedGroups.forEach(groupNodes => {
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

    // 添加节点（包括 group 节点）
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

    // 计算布局
    dagre.layout(groupGraph);

    const graph = groupGraph.graph();
    const groupWidth = graph.width || 0;
    const groupHeight = graph.height || 0;

    // 更新节点位置
    groupNodes.forEach(node => {
      const nodeWithPosition = groupGraph.node(node.id);
      const dimensions = getNodeDimensions(node);

      const x = nodeWithPosition.x - dimensions.width / 2;
      const y = currentYOffset + nodeWithPosition.y - dimensions.height / 2;

      layoutConnectedNodes.push({
        ...node,
        position: { x, y },
      });
    });

    currentYOffset += groupHeight + groupSpacing;
    maxWidth = Math.max(maxWidth, groupWidth);
  });

  // 布局孤立节点
  const totalWidth = maxWidth;
  const spacing = 50;
  let currentOffset = 0;

  const layoutIsolatedNodes = isolatedNodes.map(node => {
    const dimensions = getNodeDimensions(node);

    const x = totalWidth + 100;
    const y = 30 + currentOffset;
    currentOffset += dimensions.height + spacing;

    return {
      ...node,
      position: { x, y },
    };
  });

  // 布局顶层组节点（单独排列，在其他节点之后）
  let groupYOffset = Math.max(currentYOffset, currentOffset);
  if (layoutConnectedNodes.length > 0 || layoutIsolatedNodes.length > 0) {
    groupYOffset += groupNodeSpacing; // 添加组节点和其他节点之间的间隙
  }

  const layoutGroupNodes = topLevelGroups.map(groupNode => {
    const dimensions = getNodeDimensions(groupNode);

    const position = {
      x: 140,
      y: groupYOffset,
    };

    groupYOffset += dimensions.height + groupSpacing;

    return {
      ...groupNode,
      position,
    };
  });

  // 合并所有布局后的节点
  // 需要注意：确保所有更新的 group 节点都被包含
  const nodeMap = new Map<string, FlowGraphNode>();

  // 1. 先添加所有更新后的 group 节点（包括嵌套的）
  updatedGroupNodes.forEach(n => nodeMap.set(n.id, n));

  // 2. 添加所有子节点（包括 group 的子节点，需要合并位置信息）
  layoutChildNodes.forEach(n => {
    if (n.type === 'group') {
      // 对于 group 子节点，合并 updatedGroupNodes 中的尺寸信息和 layoutChildNodes 中的位置信息
      const updatedGroup = updatedGroupNodes.find(g => g.id === n.id);
      if (updatedGroup) {
        nodeMap.set(n.id, {
          ...updatedGroup,
          position: n.position,
          parentId: n.parentId,
        });
      } else {
        nodeMap.set(n.id, n);
      }
    } else {
      // 普通子节点直接添加
      nodeMap.set(n.id, n);
    }
  });

  // 3. 添加顶层节点（非 group 的顶层节点）
  layoutConnectedNodes.forEach(n => nodeMap.set(n.id, n));
  layoutIsolatedNodes.forEach(n => nodeMap.set(n.id, n));

  // 4. 添加顶层组节点的位置
  layoutGroupNodes.forEach(n => nodeMap.set(n.id, n));

  const allLayoutNodes = Array.from(nodeMap.values());

  return { nodes: allLayoutNodes, edges };
};
