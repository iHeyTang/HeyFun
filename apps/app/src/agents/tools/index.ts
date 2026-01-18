import { Tool, ToolRegistry } from './registry';
/**
 * 工具盒
 */
import { baseToolboxes } from './base';
import { aigcToolboxes } from './aigc';
import { webSearchToolboxes } from './web-search';
import { amapToolboxes } from './amap';
import { sandboxToolboxes } from './sandbox';
import { presentationToolboxes } from './presentation';
import { browserToolboxes } from './browser';
import { noteToolboxes } from './note';
/**
 * 全局工具注册表实例
 */
const toolRegistry = new ToolRegistry();

// 注册所有工具
const allTools: Tool[] = [
  ...baseToolboxes,
  ...aigcToolboxes,
  ...webSearchToolboxes,
  ...amapToolboxes,
  ...sandboxToolboxes,
  ...presentationToolboxes,
  ...browserToolboxes,
  ...noteToolboxes,
].flat();

// 注册所有工具（会自动同步到工具库）
toolRegistry.registerTools(allTools);

export { toolRegistry, ToolRegistry };

// Toolboxes
export { aigcToolboxes } from './aigc';
export { baseToolboxes } from './base';
export { webSearchToolboxes } from './web-search';
export { amapToolboxes } from './amap';
export { sandboxToolboxes } from './sandbox';
export { presentationToolboxes } from './presentation';
export { browserToolboxes } from './browser';
export { noteToolboxes } from './note';