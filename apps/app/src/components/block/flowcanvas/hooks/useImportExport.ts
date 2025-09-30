import { useFlowGraph } from './useFlowGraph';
import { useCallback, useMemo } from 'react';

export const useImportExport = () => {
  const reactFlowInstance = useFlowGraph();

  /**
   * Export entire canvas as JSON
   */
  const exportCanvasToJson = useCallback(() => {
    const nodes = reactFlowInstance.reactFlowInstance.getNodes();
    const edges = reactFlowInstance.reactFlowInstance.getEdges();
    return JSON.stringify({ nodes, edges });
  }, [reactFlowInstance]);

  /**
   * Import canvas data
   */
  const importCanvasFromJson = useCallback(
    (data: string) => {
      const canvasData = JSON.parse(data);
      reactFlowInstance.reactFlowInstance.setNodes(canvasData.nodes);
      reactFlowInstance.reactFlowInstance.setEdges(canvasData.edges);
    },
    [reactFlowInstance],
  );

  return useMemo(
    () => ({
      exportCanvasToJson,
      importCanvasFromJson,
    }),
    [exportCanvasToJson, importCanvasFromJson],
  );
};

export default useImportExport;
