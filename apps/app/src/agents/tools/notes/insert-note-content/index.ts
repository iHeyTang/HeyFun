import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { insertNoteContentExecutor } from './executor';
import { insertNoteContentSchema } from './schema';

export const insertNoteContentTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: insertNoteContentSchema,
  executor: insertNoteContentExecutor,
};
