import { Edge } from '@xyflow/react';
import { FlowGraphNode } from './nodes';

export interface CanvasSchema {
  nodes: FlowGraphNode[];
  edges: Edge[];
}
