/**
 * 服务端工具注册表
 * 用于在后端执行服务端工具
 */

import { BaseToolbox, ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { GeneralToolboxContext as GeneralTToolboxContext } from './context';
import { getCurrentTimeTool } from './tools/get-current-time';
import { getCurrentWeatherTool } from './tools/get-current-weather';
import { waitTool } from './tools/wait';
import { webSearchTool } from './tools/web-search';
import { imageSearchTool } from './tools/image-search';
import { getAigcModelsTool } from './tools/get-aigc-models';
import { generateImageTool } from './tools/generate-image';
import { generateVideoTool } from './tools/generate-video';
import { generateAudioTool } from './tools/generate-audio';
import { generateMusicTool } from './tools/generate-music';

/**
 * 服务端工具执行函数
 */
export type GeneralToolExecutor = ToolExecutor<GeneralTToolboxContext>;

/**
 * 服务端工具注册表
 */
class GeneralTToolbox extends BaseToolbox<GeneralToolExecutor, GeneralTToolboxContext> {
  protected registryName = 'GeneralToolbox';
  protected toolTypeName = 'General';
}

/**
 * 全局服务端工具注册表实例
 */
const generalToolbox = new GeneralTToolbox();

generalToolbox.registerMany([
  getCurrentTimeTool,
  getCurrentWeatherTool,
  waitTool,
  webSearchTool,
  imageSearchTool,
  getAigcModelsTool,
  generateImageTool,
  generateVideoTool,
  generateAudioTool,
  generateMusicTool,
]);

export { generalToolbox };
