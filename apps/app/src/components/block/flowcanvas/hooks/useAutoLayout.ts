import { useCallback } from 'react';
import { getLayoutElements, layoutGroup as layoutGroupUtil } from '../utils/layout';
import { useFlowGraph } from './useFlowGraph';

/**
 * 自动布局 Hook
 * 提供一键整理节点位置的功能
 */
export const useAutoLayout = () => {
  const flowGraph = useFlowGraph();

  /**
   * 执行全局自动布局
   * @param direction - 布局方向: 'TB' (从上到下) 或 'LR' (从左到右)
   */
  const autoLayout = useCallback(
    (direction: 'TB' | 'LR' = 'TB') => {
      const nodes = flowGraph.reactFlowInstance.getNodes();
      const edges = flowGraph.reactFlowInstance.getEdges();

      if (nodes.length === 0) {
        return;
      }

      const { nodes: layoutNodes, edges: layoutEdges } = getLayoutElements(nodes, edges, direction);

      flowGraph.reactFlowInstance.setNodes(layoutNodes);
      flowGraph.reactFlowInstance.setEdges(layoutEdges);

      // 添加平滑动画效果，布局完成后自动适配视图
      window.requestAnimationFrame(() => {
        flowGraph.reactFlowInstance.fitView({
          duration: 300,
          padding: 0.2,
          maxZoom: 1.5,
        });
      });
    },
    [flowGraph.reactFlowInstance],
  );

  /**
   * 单独为某个 group 执行布局
   * @param groupId - group 节点的 ID
   * @param direction - 布局方向: 'TB' (从上到下) 或 'LR' (从左到右)
   */
  const layoutGroup = useCallback(
    (groupId: string, direction: 'TB' | 'LR' = 'TB') => {
      const nodes = flowGraph.reactFlowInstance.getNodes();
      const edges = flowGraph.reactFlowInstance.getEdges();

      const updatedNodes = layoutGroupUtil(groupId, nodes, edges, direction);

      flowGraph.reactFlowInstance.setNodes(updatedNodes);
    },
    [flowGraph.reactFlowInstance],
  );

  return { autoLayout, layoutGroup };
};
