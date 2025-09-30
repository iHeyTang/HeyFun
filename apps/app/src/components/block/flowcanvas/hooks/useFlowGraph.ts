import { Edge, Node, useReactFlow } from '@xyflow/react';
import { FlowGraphNode, NodeData, NodeInput } from '../types/nodes';
import { useMemo } from 'react';

class FlowGraphInstance {
  private reactFlowInstance: ReturnType<typeof useReactFlow<FlowGraphNode, Edge>>;

  constructor(reactFlowInstance: ReturnType<typeof useReactFlow<FlowGraphNode, Edge>>) {
    this.reactFlowInstance = reactFlowInstance;
  }

  /**
   * Export entire canvas as JSON
   */
  exportCanvas(): string {
    const nodes = this.reactFlowInstance.getNodes();
    const edges = this.reactFlowInstance.getEdges();
    const viewport = this.reactFlowInstance.getViewport();
    return JSON.stringify({ nodes, edges, viewport });
  }

  /**
   * Import canvas data
   */
  importCanvas(data: string): void {
    const canvasData = JSON.parse(data);
    this.reactFlowInstance.setNodes(canvasData.nodes);
    this.reactFlowInstance.setEdges(canvasData.edges);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): FlowGraphNode[] {
    const reactFlowNodes = this.reactFlowInstance.getNodes();
    return reactFlowNodes;
  }

  /**
   * Get all edges
   */
  getAllEdges() {
    return this.reactFlowInstance.getEdges();
  }

  /**
   * Get current viewport
   */
  getViewport() {
    return this.reactFlowInstance.getViewport();
  }

  /**
   * Get node by ID
   */
  getNodeById(id: string): FlowGraphNode | undefined {
    const reactFlowNode = this.reactFlowInstance.getNode(id);
    return reactFlowNode ? reactFlowNode : undefined;
  }

  /**
   * Add new node
   */
  addNode(node: FlowGraphNode): void {
    this.reactFlowInstance.addNodes([node]);
  }

  addEdge(edge: Edge): void {
    this.reactFlowInstance.addEdges([edge]);
  }

  /**
   * Update node data
   */
  updateNodeData(nodeId: string, newData: Partial<Node['data']>): void {
    this.reactFlowInstance.setNodes(nodes => {
      return nodes.map(node => (node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node));
    });
  }

  /**
   * Delete node
   */
  deleteNode(nodeId: string): void {
    this.reactFlowInstance.deleteElements({ nodes: [{ id: nodeId }] });
  }

  /**
   * Get canvas statistics
   */
  getCanvasStats() {
    const nodes = this.getAllNodes();
    const edges = this.getAllEdges();

    const nodesByType = nodes.reduce(
      (acc, node) => {
        acc[node.type!] = (acc[node.type!] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodesByType,
      canvasSize: this.reactFlowInstance.getViewport(),
    };
  }

  /**
   * Fit view to all nodes
   */
  fitView(): void {
    this.reactFlowInstance.fitView();
  }

  /**
   * Center view on specific node
   */
  centerOnNode(nodeId: string): void {
    const node = this.getNodeById(nodeId);
    if (node) {
      this.reactFlowInstance.setCenter(node.position.x, node.position.y);
    }
  }

  getNodeInputsById(nodeId: string): NodeInput {
    const edges = this.getAllEdges();
    const nodes = this.getAllNodes();

    // Find all incoming edges to this node
    const incomingEdges = edges.filter(edge => edge.target === nodeId);

    const inputs: NodeInput = new Map();

    // For each incoming edge, get the source node's output
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(node => node.id === edge.source);
      const sourceNodeData = sourceNode?.data as NodeData;
      const sourceOutput = sourceNodeData.output;
      if (sourceOutput) {
        // Use the edge's sourceHandle as the key, or fall back to source node id
        const outputKey = edge.source;
        inputs.set(outputKey, sourceOutput);
      }
    }

    return inputs;
  }

  getPreNodesById(nodeId: string): FlowGraphNode[] {
    const edges = this.getAllEdges();
    const nodes = this.getAllNodes();
    return edges
      .filter(edge => edge.target === nodeId)
      .map(edge => nodes.find(node => node.id === edge.source))
      .filter(node => node !== undefined);
  }

  /**
   * 将画布像素位置转换为viewport相对位置
   * @param position 画布上的像素位置 { x: number, y: number }
   * @returns viewport相对位置 { x: number, y: number }
   */
  canvasPositionToViewport(position: { x: number; y: number }): { x: number; y: number } {
    const viewport = this.getViewport();

    // ReactFlow的viewport包含x, y偏移和zoom缩放
    // 画布像素位置需要根据viewport的变换进行转换
    const viewportX = (position.x - viewport.x) / viewport.zoom;
    const viewportY = (position.y - viewport.y) / viewport.zoom;

    return {
      x: viewportX,
      y: viewportY,
    };
  }

  /**
   * 将viewport相对位置转换为画布像素位置
   * @param position viewport相对位置 { x: number, y: number }
   * @returns 画布像素位置 { x: number, y: number }
   */
  viewportPositionToCanvas(position: { x: number; y: number }): { x: number; y: number } {
    const viewport = this.getViewport();

    // 将viewport相对位置转换为画布像素位置
    const canvasX = position.x * viewport.zoom + viewport.x;
    const canvasY = position.y * viewport.zoom + viewport.y;

    return {
      x: canvasX,
      y: canvasY,
    };
  }

  cleanupInvalidEdges(currentNodes: FlowGraphNode[], currentEdges: Edge[]): void {
    const nodeIds = new Set(currentNodes.map(node => node.id));
    const validEdges = currentEdges.filter(edge => {
      const isValid = nodeIds.has(edge.source) && nodeIds.has(edge.target);
      if (!isValid) {
        console.warn(
          `清理无效边: ${edge.source} -> ${edge.target}，源节点存在: ${nodeIds.has(edge.source)}, 目标节点存在: ${nodeIds.has(edge.target)}`,
        );
      }
      return isValid;
    });

    if (validEdges.length !== currentEdges.length) {
      console.log(`清理了 ${currentEdges.length - validEdges.length} 条无效边`);
    }

    this.reactFlowInstance.setEdges(validEdges);
  }
}

/**
 * Hook to get Canvas API instance
 */
export const useFlowGraph = () => {
  const reactFlowInstance = useReactFlow<FlowGraphNode, Edge>();
  return useMemo(() => {
    return new FlowGraphInstance(reactFlowInstance);
  }, [reactFlowInstance]);
};
