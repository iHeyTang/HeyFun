import { useCallback } from 'react';
import { useFlowGraphContext } from '../FlowCanvasProvider';
import { NodeStatusData, UnifiedScheduler } from '../scheduler/core';
import { CanvasSchema } from '../types/canvas';
import { NodeData, NodeExecutor } from '../types/nodes';
import { useFlowGraph } from './useFlowGraph';

/**
 * 使用Context的工作流运行器Hook
 * 自动集成NodeStatusContext进行状态管理
 */
export function useWorkflowRunner({ onSchemaChange }: { onSchemaChange?: (schema: CanvasSchema) => void }) {
  const context = useFlowGraphContext();
  const flowGraph = useFlowGraph();

  const onNodeOutputChange = useCallback(
    (nodeId: string, output: NodeData['output']) => {
      // 这个函数会被缓存，导致在异步执行请求的过程中，nodes和edges发生的变化无法通过 useNodesState 和 useEdgesState 更新
      // 所以需要手动获取最新的nodes和edges
      const nodes = flowGraph.reactFlowInstance.getNodes();
      const edges = flowGraph.reactFlowInstance.getEdges();
      const node = nodes.find(node => node.id === nodeId);
      if (node) {
        node.data.output = {
          images: {
            list: [...(output?.images?.list || []), ...(node.data.output?.images?.list || [])],
            selected: output?.images?.selected || node.data.output?.images?.selected || '',
          },
          videos: {
            list: [...(output?.videos?.list || []), ...(node.data.output?.videos?.list || [])],
            selected: output?.videos?.selected || node.data.output?.videos?.selected || '',
          },
          audios: {
            list: [...(output?.audios?.list || []), ...(node.data.output?.audios?.list || [])],
            selected: output?.audios?.selected || node.data.output?.audios?.selected || '',
          },
          musics: {
            list: [...(output?.musics?.list || []), ...(node.data.output?.musics?.list || [])],
            selected: output?.musics?.selected || node.data.output?.musics?.selected || '',
          },
          texts: {
            list: [...(output?.texts?.list || []), ...(node.data.output?.texts?.list || [])],
            selected: output?.texts?.selected || node.data.output?.texts?.selected || '',
          },
        };
      }
      onSchemaChange?.({ nodes, edges });
    },
    [flowGraph.reactFlowInstance.getNodes, flowGraph.reactFlowInstance.getEdges, onSchemaChange],
  );

  // 运行工作流
  const runWorkflow = useCallback(
    async (
      schema: CanvasSchema,
      triggerNodeId?: string,
      nodeExecutors?: Map<string, NodeExecutor>,
    ): Promise<{
      success: boolean;
      nodeStates: Map<string, NodeStatusData>;
      errors: Array<{ nodeId: string; error: string }>;
    }> => {
      return UnifiedScheduler.runWorkflow(schema, triggerNodeId, context, { nodeExecutors, onNodeOutputChange });
    },
    [context, onNodeOutputChange],
  );

  return {
    runWorkflow,
  };
}
