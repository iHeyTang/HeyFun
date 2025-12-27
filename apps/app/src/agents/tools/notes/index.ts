import { getCurrentNoteTool } from './get-current-note';
import { updateNoteContentTool } from './update-note-content';
import { insertNoteContentTool } from './insert-note-content';
import { replaceNoteContentTool } from './replace-note-content';
import { updateNoteTitleTool } from './update-note-title';

export * from './get-current-note';
export * from './update-note-content';
export * from './insert-note-content';
export * from './replace-note-content';
export * from './update-note-title';

export const notesToolboxes = [getCurrentNoteTool, updateNoteContentTool, insertNoteContentTool, replaceNoteContentTool, updateNoteTitleTool];
