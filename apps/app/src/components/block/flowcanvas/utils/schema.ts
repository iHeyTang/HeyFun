import { Edge } from '@xyflow/react';
import { CanvasSchema } from '../types/canvas';
import { FlowGraphNode } from '../types/nodes';

/**
 * 不需要持久化的节点属性（临时 UI 状态）
 * 采用黑名单机制：明确列出不需要同步的属性
 * 使用 satisfies 确保所有属性都是 FlowGraphNode 的有效 key
 */
const EXCLUDED_NODE_PROPERTIES = [
  'selected',
  'dragging',
  'draggable',
  'selectable',
  'connectable',
  'deletable',
  'measured',
] as const satisfies readonly (keyof FlowGraphNode)[];

/**
 * 不需要持久化的边属性（临时 UI 状态）
 * 使用 satisfies 确保所有属性都是 Edge 的有效 key
 */
const EXCLUDED_EDGE_PROPERTIES = ['selected', 'selectable', 'deletable', 'reconnectable'] as const satisfies readonly (keyof Edge)[];

/**
 * 排除的节点属性类型（从字面量数组推导出精确的联合类型）
 */
type ExcludedNodeProperty = (typeof EXCLUDED_NODE_PROPERTIES)[number];

/**
 * 排除的边属性类型（从字面量数组推导出精确的联合类型）
 */
type ExcludedEdgeProperty = (typeof EXCLUDED_EDGE_PROPERTIES)[number];

/**
 * 归一化后的节点类型 - 排除临时 UI 状态
 */
type NormalizedNode = Omit<FlowGraphNode, ExcludedNodeProperty>;

/**
 * 归一化后的边类型 - 排除临时 UI 状态
 */
type NormalizedEdge = Omit<Edge, ExcludedEdgeProperty>;

/**
 * 检查属性是否应该被排除（节点）
 */
function isNodePropertyExcluded(key: string): key is ExcludedNodeProperty {
  return EXCLUDED_NODE_PROPERTIES.includes(key as ExcludedNodeProperty);
}

/**
 * 检查属性是否应该被排除（边）
 */
function isEdgePropertyExcluded(key: string): key is ExcludedEdgeProperty {
  return EXCLUDED_EDGE_PROPERTIES.includes(key as ExcludedEdgeProperty);
}

/**
 * 归一化节点 - 排除不需要持久化的属性
 */
function normalizeNode(node: FlowGraphNode): NormalizedNode {
  const normalized: Partial<Record<string, unknown>> = {};

  // 遍历节点的所有属性
  (Object.keys(node) as Array<keyof FlowGraphNode>).forEach(key => {
    // 只保留不在排除列表中的属性
    if (!isNodePropertyExcluded(key as string)) {
      normalized[key as string] = node[key];
    }
  });

  return normalized as NormalizedNode;
}

/**
 * 归一化边 - 排除不需要持久化的属性
 */
function normalizeEdge(edge: Edge): NormalizedEdge {
  const normalized: Partial<Record<string, unknown>> = {};

  // 遍历边的所有属性
  (Object.keys(edge) as Array<keyof Edge>).forEach(key => {
    // 只保留不在排除列表中的属性
    if (!isEdgePropertyExcluded(key as string)) {
      normalized[key as string] = edge[key];
    }
  });

  return normalized as NormalizedEdge;
}

/**
 * 归一化 Schema - 过滤掉所有临时 UI 状态
 * @param schema - 原始 schema
 * @returns 归一化后的 schema，只包含需要持久化的数据
 */
export function normalizeSchema(schema: CanvasSchema): CanvasSchema {
  return {
    nodes: schema.nodes.map(normalizeNode) as FlowGraphNode[],
    edges: schema.edges.map(normalizeEdge) as Edge[],
  };
}

/**
 * 深度比较两个值是否相等
 * 使用泛型确保类型安全
 */
function deepEqual<T>(a: T, b: T): boolean {
  // 原始值比较
  if (a === b) return true;

  // null/undefined 检查
  if (a == null || b == null) return a === b;

  // 类型检查
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  // 比较数组
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  // 数组和非数组不相等
  if (Array.isArray(a) || Array.isArray(b)) return false;

  // 比较 Map
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a.entries()) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) {
        return false;
      }
    }
    return true;
  }

  // Map 和非 Map 不相等
  if (a instanceof Map || b instanceof Map) return false;

  // 比较 Set
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const value of a.values()) {
      if (!b.has(value)) {
        return false;
      }
    }
    return true;
  }

  // Set 和非 Set 不相等
  if (a instanceof Set || b instanceof Set) return false;

  // 比较 Date
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Date 和非 Date 不相等
  if (a instanceof Date || b instanceof Date) return false;

  // 比较普通对象
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(key => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

/**
 * 比较两个 Schema 是否相等（只比较需要持久化的部分）
 * @param schemaA - Schema A
 * @param schemaB - Schema B
 * @returns 如果两个 schema 的持久化数据相等，返回 true
 */
export function isSchemaEqual(schemaA: CanvasSchema, schemaB: CanvasSchema): boolean {
  const normalizedA = normalizeSchema(schemaA);
  const normalizedB = normalizeSchema(schemaB);

  return deepEqual(normalizedA, normalizedB);
}

/**
 * 自定义归一化选项
 */
interface NormalizeSchemaOptions {
  /** 额外需要排除的节点属性 */
  additionalExcludeNodeProps?: readonly string[];
  /** 额外需要排除的边属性 */
  additionalExcludeEdgeProps?: readonly string[];
  /** 强制包含的节点属性（覆盖排除列表） */
  forceIncludeNodeProps?: readonly string[];
  /** 强制包含的边属性（覆盖排除列表） */
  forceIncludeEdgeProps?: readonly string[];
}

/**
 * 可选：如果你需要自定义哪些属性需要持久化，可以使用这个函数
 * @param schema - 原始 schema
 * @param options - 自定义配置
 * @returns 归一化后的 schema
 */
export function normalizeSchemaWithOptions(schema: CanvasSchema, options?: NormalizeSchemaOptions): CanvasSchema {
  // 构建节点排除集合
  const excludedNodeProps = new Set<string>([...EXCLUDED_NODE_PROPERTIES, ...(options?.additionalExcludeNodeProps || [])]);

  // 构建边排除集合
  const excludedEdgeProps = new Set<string>([...EXCLUDED_EDGE_PROPERTIES, ...(options?.additionalExcludeEdgeProps || [])]);

  // 移除强制包含的属性
  options?.forceIncludeNodeProps?.forEach(prop => excludedNodeProps.delete(prop));
  options?.forceIncludeEdgeProps?.forEach(prop => excludedEdgeProps.delete(prop));

  return {
    nodes: schema.nodes.map(node => {
      const normalized: Partial<Record<string, unknown>> = {};
      (Object.keys(node) as Array<keyof FlowGraphNode>).forEach(key => {
        if (!excludedNodeProps.has(key as string)) {
          normalized[key as string] = node[key];
        }
      });
      return normalized as FlowGraphNode;
    }),
    edges: schema.edges.map(edge => {
      const normalized: Partial<Record<string, unknown>> = {};
      (Object.keys(edge) as Array<keyof Edge>).forEach(key => {
        if (!excludedEdgeProps.has(key as string)) {
          normalized[key as string] = edge[key];
        }
      });
      return normalized as Edge;
    }),
  };
}

/**
 * 工具函数：获取所有排除的属性列表（用于调试和文档）
 */
export function getExcludedProperties(): {
  nodes: readonly string[];
  edges: readonly string[];
} {
  return {
    nodes: EXCLUDED_NODE_PROPERTIES,
    edges: EXCLUDED_EDGE_PROPERTIES,
  };
}
