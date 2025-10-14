import { useCallback } from 'react';
import { getLayoutedElements } from '../utils/layout';
import { useFlowGraph } from './useFlowGraph';

/**
 * 自动布局 Hook
 * 提供一键整理节点位置的功能
 */
export const useAutoLayout = () => {
  const flowGraph = useFlowGraph();

  /**
   * 执行自动布局
   * @param direction - 布局方向: 'TB' (从上到下) 或 'LR' (从左到右)
   */
  const autoLayout = useCallback(
    (direction: 'TB' | 'LR' = 'TB') => {
      const nodes = flowGraph.reactFlowInstance.getNodes();
      const edges = flowGraph.reactFlowInstance.getEdges();

      if (nodes.length === 0) {
        return;
      }

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, direction);

      flowGraph.reactFlowInstance.setNodes(layoutedNodes);
      flowGraph.reactFlowInstance.setEdges(layoutedEdges);

      // 添加平滑动画效果，布局完成后自动适配视图
      window.requestAnimationFrame(() => {
        flowGraph.reactFlowInstance.fitView({
          duration: 300,
          padding: 0.2,
          maxZoom: 1.5,
        });
      });
    },
    [
      flowGraph.reactFlowInstance.getNodes,
      flowGraph.reactFlowInstance.getEdges,
      flowGraph.reactFlowInstance.setNodes,
      flowGraph.reactFlowInstance.setEdges,
      flowGraph.reactFlowInstance.fitView,
    ],
  );

  return { autoLayout };
};
