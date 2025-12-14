/**
 * 前端工具注册表
 * 前端只需要注册函数到工具名，实现由前端提供
 */

import { BaseToolbox, ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { CanvasToolboxContext } from './context';
import { autoLayoutCanvasTool } from './tools/auto-layout-canvas';
import { editFlowCanvasTool } from './tools/edit-flow-canvas';
import { getCanvasCapabilitiesTool } from './tools/get-canvas-capabilities';
import { getCanvasStateTool } from './tools/get-canvas-state';
import { getNodeTypeInfoTool } from './tools/get-node-type';
import { runCanvasWorkflowTool } from './tools/run-canvas-workflow';

/**
 * Canvas 工具执行函数
 */
export type ClientToolExecutor = ToolExecutor<CanvasToolboxContext>;

/**
 * Canvas 工具注册表
 */
class CanvasToolbox extends BaseToolbox<ClientToolExecutor, CanvasToolboxContext> {
  protected registryName = 'CanvasToolbox';
  protected toolTypeName = 'Canvas';
}

/**
 * 全局前端工具注册表实例
 */
const canvasToolbox = new CanvasToolbox();

canvasToolbox.registerMany([
  autoLayoutCanvasTool,
  editFlowCanvasTool,
  getCanvasCapabilitiesTool,
  getCanvasStateTool,
  getNodeTypeInfoTool,
  runCanvasWorkflowTool,
]);

export { canvasToolbox };
