import { Edge, Node, useReactFlow } from '@xyflow/react';
import { FlowGraphNode, NodeData, NodeInput } from '../types/nodes';
import { useMemo } from 'react';

class FlowGraphInstance {
  reactFlowInstance: ReturnType<typeof useReactFlow<FlowGraphNode, Edge>>;

  constructor(reactFlowInstance: ReturnType<typeof useReactFlow<FlowGraphNode, Edge>>) {
    this.reactFlowInstance = reactFlowInstance;
  }

  /**
   * Get node by ID
   */
  getNodeById(id: string): FlowGraphNode | undefined {
    const reactFlowNode = this.reactFlowInstance.getNode(id);
    return reactFlowNode ? reactFlowNode : undefined;
  }

  /**
   * Update node data
   */
  updateNodeData(nodeId: string, newData: Partial<Node['data']>): void {
    this.reactFlowInstance.setNodes(nodes => {
      return nodes.map(node => (node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node));
    });
  }

  getNodeInputsById(nodeId: string): NodeInput {
    const edges = this.reactFlowInstance.getEdges();
    const nodes = this.reactFlowInstance.getNodes();

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
    const edges = this.reactFlowInstance.getEdges();
    const nodes = this.reactFlowInstance.getNodes();
    return edges
      .filter(edge => edge.target === nodeId)
      .map(edge => nodes.find(node => node.id === edge.source))
      .filter(node => node !== undefined);
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
