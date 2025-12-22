import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { updateNoteContentSchema } from './schema';
import { updateNoteContentExecutor } from './executor';

export const updateNoteContentTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: updateNoteContentSchema,
  executor: updateNoteContentExecutor,
};

