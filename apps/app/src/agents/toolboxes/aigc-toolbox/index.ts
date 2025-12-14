/**
 * AIGC 工具注册表
 * 用于在后端执行 AIGC 相关工具
 */

import { BaseToolbox, ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { AigcToolboxContext } from './context';
import { generateImageTool } from './tools/generate-image';
import { generateVideoTool } from './tools/generate-video';
import { generateAudioTool } from './tools/generate-audio';
import { generateMusicTool } from './tools/generate-music';
import { getAigcModelsTool } from './tools/get-aigc-models';
import { getGenerationResultTool } from './tools/get-generation-result';

/**
 * AIGC 工具执行函数
 */
export type AigcToolExecutor = ToolExecutor<AigcToolboxContext>;

/**
 * AIGC 工具注册表
 */
class AigcToolbox extends BaseToolbox<AigcToolExecutor, AigcToolboxContext> {
  protected registryName = 'AigcToolbox';
  protected toolTypeName = 'AIGC';
}

/**
 * 全局 AIGC 工具注册表实例
 */
const aigcToolbox = new AigcToolbox();

aigcToolbox.registerMany([
  generateImageTool,
  generateVideoTool,
  generateAudioTool,
  generateMusicTool,
  getAigcModelsTool,
  getGenerationResultTool,
]);

export { aigcToolbox };

