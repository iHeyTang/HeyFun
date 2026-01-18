/**
 * Note 工具集合
 * 提供笔记的创建、读取、编辑功能
 * 创建的笔记会自动关联到当前会话作为素材资产
 */

import { noteCreateTool } from './create';
import { noteReadTool } from './read';
import { noteEditTool } from './edit';

export const noteToolboxes = [noteCreateTool, noteReadTool, noteEditTool];

export { noteCreateTool } from './create';
export { noteReadTool } from './read';
export { noteEditTool } from './edit';
