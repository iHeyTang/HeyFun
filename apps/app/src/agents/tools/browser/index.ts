/**
 * 浏览器工具集合
 * 在 sandbox 中运行浏览器自动化脚本，提供浏览器操作能力
 */

import { browserNavigateTool } from './navigate';
import { browserClickTool } from './click';
import { browserExtractContentTool } from './extract-content';

export const browserToolboxes = [browserNavigateTool, browserClickTool, browserExtractContentTool];

