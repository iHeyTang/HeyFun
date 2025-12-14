import { editFlowCanvasDefinition } from './edit-flow-canvas';
import { getCanvasStateDefinition } from './get-canvas-state';
import { getCanvasCapabilitiesDefinition } from './get-canvas-capabilities';
import { getNodeTypeInfoDefinition } from './get-node-type-info';
import { autoLayoutDefinition } from './auto-layout';
import { runWorkflowDefinition } from './run-workflow';

export const COORDINATOR_TOOLS = [
  editFlowCanvasDefinition,
  getCanvasStateDefinition,
  getCanvasCapabilitiesDefinition,
  getNodeTypeInfoDefinition,
  autoLayoutDefinition,
  runWorkflowDefinition,
];
