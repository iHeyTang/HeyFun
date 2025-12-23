/**
 * 统一工具注册表
 * 所有工具都在这里注册
 */

import { BaseToolbox, ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolContext } from './context';
import { getCurrentTimeTool } from './get-current-time';
import { webSearchTool } from './web-search';
import { waitTool } from './wait';
import { getCurrentWeatherTool } from './get-current-weather';
import { getAigcModelsTool } from './get-aigc-models';
import { generateImageTool } from './generate-image';
import { generateVideoTool } from './generate-video';
import { generateAudioTool } from './generate-audio';
import { generateMusicTool } from './generate-music';
import { imageSearchTool } from './image-search';
import { getCurrentNoteTool } from './get-current-note';
import { updateNoteContentTool } from './update-note-content';
import { insertNoteContentTool } from './insert-note-content';
import { replaceNoteContentTool } from './replace-note-content';
import { updateNoteTitleTool } from './update-note-title';
import { editFlowCanvasTool } from './edit-flow-canvas';
import { getCanvasStateTool } from './get-canvas-state';
import { getCanvasCapabilitiesTool } from './get-canvas-capabilities';
import { getNodeTypeInfoTool } from './get-node-type-info';
import { autoLayoutCanvasTool } from './auto-layout-canvas';
import { runCanvasWorkflowTool } from './run-canvas-workflow';

/**
 * 工具类型定义
 */
export type Tool = {
  schema: import('@/agents/core/tools/tool-definition').ToolDefinition;
  executor: ToolExecutor<ToolContext>;
};

/**
 * 工具注册表
 */
class ToolRegistry extends BaseToolbox<ToolExecutor<ToolContext>, ToolContext> {
  protected registryName = 'ToolRegistry';
  protected toolTypeName = 'Tool';

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.register(tool.schema.name, tool.executor);
  }

  /**
   * 批量注册工具
   */
  registerTools(tools: Tool[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * 获取所有工具定义
   */
  getAllToolSchemas(): import('@/agents/core/tools/tool-definition').ToolDefinition[] {
    const schemas: import('@/agents/core/tools/tool-definition').ToolDefinition[] = [];
    for (const toolName of this.getAllToolNames()) {
      // 这里需要从工具模块中获取schema，暂时返回空数组
      // 实际使用时，应该从工具模块中获取
    }
    return schemas;
  }
}

/**
 * 全局工具注册表实例
 */
const toolRegistry = new ToolRegistry();

// 注册所有工具
const allTools: Tool[] = [
  // General tools
  getCurrentTimeTool,
  webSearchTool,
  waitTool,
  getCurrentWeatherTool,
  getAigcModelsTool,
  generateImageTool,
  generateVideoTool,
  generateAudioTool,
  generateMusicTool,
  imageSearchTool,
  // Notes tools
  getCurrentNoteTool,
  updateNoteContentTool,
  insertNoteContentTool,
  replaceNoteContentTool,
  updateNoteTitleTool,
  // Canvas tools
  editFlowCanvasTool,
  getCanvasStateTool,
  getCanvasCapabilitiesTool,
  getNodeTypeInfoTool,
  autoLayoutCanvasTool,
  runCanvasWorkflowTool,
  // UI tools
  // humanInLoopTool,
];

toolRegistry.registerTools(allTools);

export { toolRegistry, ToolRegistry };

// 导出所有工具定义，供 presets 使用
// 每个 Agent 应该根据自己的需求从 ALL_TOOLS 中选择需要的工具
export const ALL_TOOLS = allTools.map(tool => tool.schema);

// 导出各个工具的定义，方便 Agent 按需导入
export { getCurrentTimeTool } from './get-current-time';
export { webSearchTool } from './web-search';
export { waitTool } from './wait';
export { getCurrentWeatherTool } from './get-current-weather';
export { getAigcModelsTool } from './get-aigc-models';
export { generateImageTool } from './generate-image';
export { generateVideoTool } from './generate-video';
export { generateAudioTool } from './generate-audio';
export { generateMusicTool } from './generate-music';
export { imageSearchTool } from './image-search';
export { getCurrentNoteTool } from './get-current-note';
export { updateNoteContentTool } from './update-note-content';
export { insertNoteContentTool } from './insert-note-content';
export { replaceNoteContentTool } from './replace-note-content';
export { updateNoteTitleTool } from './update-note-title';
export { editFlowCanvasTool } from './edit-flow-canvas';
export { getCanvasStateTool } from './get-canvas-state';
export { getCanvasCapabilitiesTool } from './get-canvas-capabilities';
export { getNodeTypeInfoTool } from './get-node-type-info';
export { autoLayoutCanvasTool } from './auto-layout-canvas';
export { runCanvasWorkflowTool } from './run-canvas-workflow';
export { humanInLoopTool } from './human-in-loop';

