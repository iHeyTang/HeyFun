/**
 * Web Search 工具注册表
 * 用于在后端执行 Web Search 相关工具
 */

import { BaseToolbox, ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { WebSearchToolboxContext } from './context';
import { webSearchTool } from './tools/web-search';
import { imageSearchTool } from './tools/image-search';

/**
 * Web Search 工具执行函数
 */
export type WebSearchToolExecutor = ToolExecutor<WebSearchToolboxContext>;

/**
 * Web Search 工具注册表
 */
class WebSearchToolbox extends BaseToolbox<WebSearchToolExecutor, WebSearchToolboxContext> {
  protected registryName = 'WebSearchToolbox';
  protected toolTypeName = 'WebSearch';
}

/**
 * 全局 Web Search 工具注册表实例
 */
const webSearchToolbox = new WebSearchToolbox();

webSearchToolbox.registerMany([webSearchTool, imageSearchTool]);

export { webSearchToolbox };
