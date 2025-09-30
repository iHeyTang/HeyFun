import { Edge } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import { CanvasSchema } from '../types/canvas';
import { FlowGraphNode } from '../types/nodes';
import { isSchemaEqual, normalizeSchema } from '../utils/schema';

interface UseSchemaSync {
  nodes: FlowGraphNode[];
  edges: Edge[];
  onSchemaChange?: (schema: CanvasSchema) => void;
}

/**
 * Schema 同步 Hook
 *
 * 这个 Hook 负责监听 nodes 和 edges 的变化，并在必要时触发 onSchemaChange。
 * 它会过滤掉不需要持久化的 UI 状态（如 selected, dragging 等），
 * 只在真正的数据变更时才触发回调。
 *
 * @param params - 包含 nodes, edges 和 onSchemaChange 回调
 */
export function useSchemaSync({ nodes, edges, onSchemaChange }: UseSchemaSync) {
  // 使用 ref 存储上一次的归一化 schema，避免不必要的比较
  const previousNormalizedSchemaRef = useRef<CanvasSchema | null>(null);

  useEffect(() => {
    // 如果没有 onSchemaChange 回调，直接返回
    if (!onSchemaChange) return;

    // 创建当前的 schema
    const currentSchema: CanvasSchema = { nodes, edges };

    // 归一化当前 schema（过滤掉 UI 状态）
    const normalizedSchema = normalizeSchema(currentSchema);

    // 如果是第一次运行，直接保存并触发回调
    if (previousNormalizedSchemaRef.current === null) {
      previousNormalizedSchemaRef.current = normalizedSchema;
      onSchemaChange(normalizedSchema);
      return;
    }

    // 比较归一化后的 schema 是否发生了实质性变化
    const hasChanged = !isSchemaEqual(previousNormalizedSchemaRef.current, normalizedSchema);

    // 只有在发生实质性变化时才触发回调
    if (hasChanged) {
      previousNormalizedSchemaRef.current = normalizedSchema;
      onSchemaChange(normalizedSchema);
    }
  }, [nodes, edges, onSchemaChange]);
}
