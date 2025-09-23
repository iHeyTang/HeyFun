import { Edge, Viewport } from '@xyflow/react';
import { FlowGraphNode } from './nodes';

export interface CanvasSchema {
  nodes: FlowGraphNode[];
  edges: Edge[];
  viewport?: Viewport;
}
