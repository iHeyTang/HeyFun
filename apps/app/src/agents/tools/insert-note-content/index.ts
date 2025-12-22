import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { insertNoteContentSchema } from './schema';
import { insertNoteContentExecutor } from './executor';

export const insertNoteContentTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: insertNoteContentSchema,
  executor: insertNoteContentExecutor,
};

