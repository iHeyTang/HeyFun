/**
 * 画布工具统一导出
 * 汇总所有工具并提供统一的访问接口
 */

import { ToolResult, ToolExecutionContext } from '../../types';
import { CanvasTool } from './base';

// 导入所有工具
import { editFlowCanvasTool } from './tools/edit-flow-canvas';
import { getCanvasStateTool } from './tools/get-canvas-state';
import { getCanvasCapabilitiesTool } from './tools/get-canvas-capabilities';
import { getNodeTypeInfoTool } from './tools/get-node-type-info';
import { autoLayoutTool } from './tools/auto-layout';
import { runWorkflowTool } from './tools/run-workflow';

/**
 * 所有画布工具的统一注册表
 * 工具定义和执行器在这里配对
 */
export const CANVAS_TOOLS: Record<string, CanvasTool> = {
  // 工作流编辑（统一工具，替代所有节点和连接管理工具）
  edit_flow_canvas: editFlowCanvasTool,

  // 查询
  get_canvas_state: getCanvasStateTool,
  get_canvas_capabilities: getCanvasCapabilitiesTool,
  get_node_type_info: getNodeTypeInfoTool,

  // 布局
  auto_layout_canvas: autoLayoutTool,

  // 工作流执行
  run_canvas_workflow: runWorkflowTool,
};

/**
 * 导出所有工具的 schema（用于 LLM）
 */
export const CANVAS_TOOL_SCHEMAS = Object.values(CANVAS_TOOLS).map(tool => tool.schema);

/**
 * 工具执行器映射表（用于浏览器端执行）
 */
export const CANVAS_TOOL_EXECUTORS: Record<string, (args: any, context: ToolExecutionContext) => Promise<ToolResult>> = Object.entries(
  CANVAS_TOOLS,
).reduce(
  (acc, [name, tool]) => {
    acc[name] = tool.executor;
    return acc;
  },
  {} as Record<string, (args: any, context: ToolExecutionContext) => Promise<ToolResult>>,
);

// 导出类型和辅助函数
export type { CanvasTool } from './base';
export { createTool } from './base';
export * from './helpers';
