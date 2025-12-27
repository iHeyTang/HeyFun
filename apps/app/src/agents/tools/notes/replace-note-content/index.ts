import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '@/agents/tools/context';
import { replaceNoteContentExecutor } from './executor';
import { replaceNoteContentSchema } from './schema';

export const replaceNoteContentTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: replaceNoteContentSchema,
  executor: replaceNoteContentExecutor,
};

