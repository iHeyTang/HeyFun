import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '@/agents/tools/context';
import { insertNoteContentExecutor } from './executor';
import { insertNoteContentSchema } from './schema';

export const insertNoteContentTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: insertNoteContentSchema,
  executor: insertNoteContentExecutor,
};
