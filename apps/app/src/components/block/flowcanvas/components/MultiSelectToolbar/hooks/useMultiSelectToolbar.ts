import { Edge, Node, OnNodesChange, useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';
import { useWorkflowRunner } from '../../../hooks';
import { FlowGraphNode, NodeExecutor } from '../../../types/nodes';
import { layoutGroup } from '../../../utils/layout';

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

  // 节点状态更新函数
  setNodes: React.Dispatch<React.SetStateAction<FlowGraphNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

/**
 * 多选工具栏扩展返回值
 */
export interface MultiSelectToolbarExtensionResult {
  // 执行方法
  onExecuteSelectedNodes: (selectedNodeIds: string[]) => Promise<void>;
  // 打组方法
  onGroupSelectedNodes: (selectedNodeIds: string[]) => void;
  // 拆组方法
  onUngroupSelectedNode: (groupNodeId: string) => void;
  // 布局 group 方法
  onLayoutGroup: (groupNodeId: string, direction: 'TB' | 'LR') => void;
}

/**
 * 多选工具栏扩展
 * 处理选中节点的执行逻辑（不负责管理选择状态）
 */
export function useMultiSelectToolbar(context: MultiSelectToolbarExtensionContext): MultiSelectToolbarExtensionResult {
  const { nodes, edges, selectedNodes, workflowRunner, nodeExecutors, setNodes, setEdges } = context;
  const reactFlowInstance = useReactFlow();

  // 执行选中的节点
  const onExecuteSelectedNodes = useCallback(
    async (selectedNodeIds: string[]) => {
      if (!nodes || !edges) {
        console.error('没有可用的工作流 schema');
        return;
      }

      try {
        // 扩展选中节点列表：如果选中的是组节点，则添加组内的所有子节点
        const expandedNodeIds = new Set<string>();
        selectedNodeIds.forEach(nodeId => {
          const node = reactFlowInstance.getNode(nodeId) as FlowGraphNode | undefined;
          if (node?.type === 'group') {
            // 如果是组节点，找到所有子节点
            const childNodes = nodes.filter(n => n.parentId === nodeId);
            childNodes.forEach(childNode => {
              expandedNodeIds.add(childNode.id);
            });
            console.log(
              `组节点 ${nodeId} 包含子节点:`,
              childNodes.map(n => n.id),
            );
          } else {
            // 如果不是组节点，直接添加
            expandedNodeIds.add(nodeId);
          }
        });

        const actualNodeIds = Array.from(expandedNodeIds);
        console.log('实际要执行的节点:', actualNodeIds);

        if (actualNodeIds.length === 0) {
          console.log('没有可执行的节点');
          return;
        }

        // 找到选中节点及其所有前置依赖节点
        const nodesToInclude = new Set<string>();
        const edgesToExecute = new Set<string>();

        // 添加选中的节点
        actualNodeIds.forEach(nodeId => {
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
        actualNodeIds.forEach(findDependencies);

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
              if (!actualNodeIds.includes(node.id)) {
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
    [nodes, edges, workflowRunner, nodeExecutors, reactFlowInstance],
  );

  // 将选中的节点打组
  const onGroupSelectedNodes = useCallback(
    (selectedNodeIds: string[]) => {
      if (selectedNodeIds.length < 2) {
        console.warn('至少需要选择2个节点才能打组');
        return;
      }

      // 过滤掉已经在组内的子节点，只保留顶层节点
      const currentNodes = reactFlowInstance.getNodes() as FlowGraphNode[];
      const topLevelNodeIds = selectedNodeIds.filter(nodeId => {
        const node = currentNodes.find(n => n.id === nodeId);
        // 只保留没有 parentId 的节点（顶层节点）
        return node && !node.parentId;
      });

      if (topLevelNodeIds.length < 2) {
        console.warn('至少需要选择2个顶层节点才能打组');
        return;
      }

      // 使用 ReactFlow 的 API 获取选中节点的边界
      const bounds = reactFlowInstance.getNodesBounds(topLevelNodeIds);

      if (!bounds) {
        console.error('无法获取节点边界');
        return;
      }

      console.log('选中节点的边界:', bounds);

      // 添加内边距
      const padding = 30;
      const groupX = bounds.x - padding;
      const groupY = bounds.y - padding;
      const groupWidth = bounds.width + padding * 2;
      const groupHeight = bounds.height + padding * 2;

      // 创建 group 节点
      const groupId = `group-${Date.now()}`;
      const groupNode: FlowGraphNode = {
        id: groupId,
        type: 'group',
        position: { x: groupX, y: groupY },
        data: {
          label: 'Group',
        },
        style: {
          width: groupWidth,
          height: groupHeight,
        },
        // 不设置 zIndex，让 ReactFlow 自动处理层级
        // group 节点会自动在子节点下方渲染
      };

      console.log('创建的 group 节点:', groupNode);

      // 更新子节点的 parentId 和位置
      const updatedNodes = currentNodes.map(node => {
        if (topLevelNodeIds.includes(node.id)) {
          const relativeX = node.position.x - groupX;
          const relativeY = node.position.y - groupY;

          return {
            ...node,
            position: { x: relativeX, y: relativeY },
            parentId: groupId,
            expandParent: true,
          } as FlowGraphNode;
        }
        return node;
      });

      // 添加 group 节点到数组开头，确保它先渲染
      const newNodes = [groupNode, ...updatedNodes];

      // 使用 reactFlowInstance 的 setNodes 方法
      reactFlowInstance.setNodes(newNodes);

      console.log('节点打组成功', { groupId, selectedNodeIds: topLevelNodeIds });

      // 打组后取消所有选择，不自动选中组节点
      setTimeout(() => {
        const allNodes = reactFlowInstance.getNodes();
        const nodesWithoutSelection = allNodes.map(node => ({
          ...node,
          selected: false,
        }));
        reactFlowInstance.setNodes(nodesWithoutSelection);
      }, 0);
    },
    [reactFlowInstance, setNodes],
  );

  // 拆组功能
  const onUngroupSelectedNode = useCallback(
    (groupNodeId: string) => {
      console.log('开始拆组:', groupNodeId);

      try {
        const currentNodes = reactFlowInstance.getNodes() as FlowGraphNode[];
        const groupNode = currentNodes.find(node => node.id === groupNodeId);

        if (!groupNode) {
          console.error('找不到分组节点');
          return;
        }

        // 检查被拆解的组是否嵌套在另一个组内
        const parentGroupId = groupNode.parentId;
        const isNestedGroup = !!parentGroupId;

        // 找到所有子节点
        const childNodes = currentNodes.filter(node => node.parentId === groupNodeId);

        // 更新所有节点：移除子节点的 parentId 并转换位置
        const updatedNodes = currentNodes
          .filter(node => node.id !== groupNodeId) // 移除 group 节点
          .map(node => {
            if (node.parentId === groupNodeId) {
              // 子节点：计算新位置
              const absoluteX = groupNode.position.x + node.position.x;
              const absoluteY = groupNode.position.y + node.position.y;

              // 如果是嵌套组，子节点应该继承外部组的 parentId
              if (isNestedGroup) {
                return {
                  ...node,
                  position: {
                    x: absoluteX,
                    y: absoluteY,
                  },
                  parentId: parentGroupId, // 继承外部组的 parentId
                  expandParent: true,
                } as FlowGraphNode;
              } else {
                // 如果不是嵌套组，子节点变成顶层节点
                const { parentId, extent, expandParent, ...restNode } = node;
                return {
                  ...restNode,
                  position: {
                    x: absoluteX,
                    y: absoluteY,
                  },
                } as FlowGraphNode;
              }
            }
            return node;
          });

        // 更新节点
        reactFlowInstance.setNodes(updatedNodes);
      } catch (error) {
        console.error('拆解分组时出错:', error);
      }
    },
    [reactFlowInstance],
  );

  // 布局 group
  const onLayoutGroup = useCallback(
    (groupNodeId: string, direction: 'TB' | 'LR' = 'TB') => {
      try {
        const currentNodes = reactFlowInstance.getNodes() as FlowGraphNode[];
        const currentEdges = reactFlowInstance.getEdges();

        // 使用布局工具函数，传入指定的方向
        const updatedNodes = layoutGroup(groupNodeId, currentNodes, currentEdges, direction);

        // 更新节点
        reactFlowInstance.setNodes(updatedNodes);
      } catch (error) {
        console.error('布局 group 时出错:', error);
      }
    },
    [reactFlowInstance],
  );

  return {
    onExecuteSelectedNodes,
    onGroupSelectedNodes,
    onUngroupSelectedNode,
    onLayoutGroup,
  };
}
