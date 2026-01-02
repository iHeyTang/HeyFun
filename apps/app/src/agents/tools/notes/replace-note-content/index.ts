import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { replaceNoteContentExecutor } from './executor';
import { replaceNoteContentSchema } from './schema';

export const replaceNoteContentTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: replaceNoteContentSchema,
  executor: replaceNoteContentExecutor,
};

