import { Edge } from '@xyflow/react';
import { useCallback } from 'react';
import { useWorkflowRunner } from '../../../hooks';
import { FlowGraphNode, NodeExecutor } from '../../../types/nodes';

/**
 * 多选工具栏扩展上下文
 */
export interface MultiSelectToolbarExtensionContext {
  // 节点和边
  nodes: FlowGraphNode[];
  edges: Edge[];

  // 选中的节点（来自 useSelection）
  selectedNodes: string[];

  // 工作流执行器
  workflowRunner: ReturnType<typeof useWorkflowRunner>;
  nodeExecutors: Map<string, NodeExecutor>;
}

/**
 * 多选工具栏扩展返回值
 */
export interface MultiSelectToolbarExtensionResult {
  // 执行方法
  onExecuteSelectedNodes: (selectedNodeIds: string[]) => Promise<void>;
}

/**
 * 多选工具栏扩展
 * 处理选中节点的执行逻辑（不负责管理选择状态）
 */
export function useMultiSelectToolbar(context: MultiSelectToolbarExtensionContext): MultiSelectToolbarExtensionResult {
  const { nodes, edges, selectedNodes, workflowRunner, nodeExecutors } = context;

  // 执行选中的节点
  const onExecuteSelectedNodes = useCallback(
    async (selectedNodeIds: string[]) => {
      if (!nodes || !edges) {
        console.error('没有可用的工作流 schema');
        return;
      }

      try {
        // 找到选中节点及其所有前置依赖节点
        const nodesToInclude = new Set<string>();
        const edgesToExecute = new Set<string>();

        // 添加选中的节点
        selectedNodeIds.forEach(nodeId => {
          nodesToInclude.add(nodeId);
        });

        // 找到所有前置依赖节点（只查找第一层）
        const findDependencies = (nodeId: string) => {
          edges?.forEach(edge => {
            if (edge.target === nodeId && !nodesToInclude.has(edge.source)) {
              nodesToInclude.add(edge.source);
              edgesToExecute.add(edge.id);
              // 只查找第一层依赖，不递归
            }
          });
        };

        // 为每个选中节点查找前置依赖
        selectedNodeIds.forEach(findDependencies);

        // 添加选中节点之间的边
        edges?.forEach(edge => {
          if (nodesToInclude.has(edge.source) && nodesToInclude.has(edge.target)) {
            edgesToExecute.add(edge.id);
          }
        });

        // 创建子工作流 schema
        const subWorkflowSchema = {
          nodes: nodes
            .filter(node => nodesToInclude.has(node.id))
            .map(node => {
              // 如果是前置依赖节点（不是选中的节点），标记为已完成状态
              if (!selectedNodeIds.includes(node.id)) {
                return { ...node, data: { ...node.data, input: new Map(), actionData: {} } };
              }
              return node;
            }),
          edges: edges.filter(edge => edgesToExecute.has(edge.id)),
          updatedAt: Date.now(),
        };

        // 使用工作流执行器运行子工作流
        // 前置依赖节点被标记为已完成状态，不会被执行，但可以提供输出数据
        // 只有选中的节点会被实际执行
        await workflowRunner.runWorkflow(subWorkflowSchema, undefined, nodeExecutors);
      } catch (error) {
        console.error('执行选中节点时出错:', error);
      }
    },
    [nodes, edges, workflowRunner, nodeExecutors],
  );

  return {
    onExecuteSelectedNodes,
  };
}
