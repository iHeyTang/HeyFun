import { getCurrentNoteDefinition } from './get-current-note';
import { updateNoteContentDefinition } from './update-note-content';
import { updateNoteTitleDefinition } from './update-note-title';
import { insertNoteContentDefinition } from './insert-note-content';
import { replaceNoteContentDefinition } from './replace-note-content';

export const NOTES_TOOLS = [
  getCurrentNoteDefinition,
  updateNoteContentDefinition,
  updateNoteTitleDefinition,
  insertNoteContentDefinition,
  replaceNoteContentDefinition,
];

