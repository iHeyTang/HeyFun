import { useCallback } from 'react';
import { useFlowGraphContext } from '../FlowCanvasProvider';
import { NodeStatusData, UnifiedScheduler } from '../scheduler/core';
import { CanvasSchema } from '../types/canvas';
import { NodeData, NodeExecutor } from '../types/nodes';

/**
 * 使用Context的工作流运行器Hook
 * 自动集成NodeStatusContext进行状态管理
 */
export function useWorkflowRunner({ onNodeOutputChange }: { onNodeOutputChange?: (nodeId: string, output: NodeData['output']) => void }) {
  const context = useFlowGraphContext();

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
