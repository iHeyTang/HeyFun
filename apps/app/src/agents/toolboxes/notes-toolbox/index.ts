/**
 * 笔记工具注册表
 * 用于在后端执行笔记相关的工具
 */

import { BaseToolbox, ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { NotesToolboxContext } from './context';
import { getCurrentNoteTool } from './tools/get-current-note';
import { updateNoteContentTool } from './tools/update-note-content';
import { updateNoteTitleTool } from './tools/update-note-title';
import { insertNoteContentTool } from './tools/insert-note-content';
import { replaceNoteContentTool } from './tools/replace-note-content';

/**
 * 笔记工具执行函数
 */
export type NotesToolExecutor = ToolExecutor<NotesToolboxContext>;

/**
 * 笔记工具注册表
 */
class NotesToolbox extends BaseToolbox<NotesToolExecutor, NotesToolboxContext> {
  protected registryName = 'NotesToolbox';
  protected toolTypeName = 'Notes';
}

/**
 * 全局笔记工具注册表实例
 */
const notesToolbox = new NotesToolbox();

notesToolbox.registerMany([
  getCurrentNoteTool,
  updateNoteContentTool,
  updateNoteTitleTool,
  insertNoteContentTool,
  replaceNoteContentTool,
]);

export { notesToolbox };

