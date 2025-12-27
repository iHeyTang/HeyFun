import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '@/agents/tools/context';
import { updateNoteContentExecutor } from './executor';
import { updateNoteContentSchema } from './schema';

export const updateNoteContentTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: updateNoteContentSchema,
  executor: updateNoteContentExecutor,
};
