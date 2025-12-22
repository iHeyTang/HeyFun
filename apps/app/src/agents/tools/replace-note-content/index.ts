import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { replaceNoteContentSchema } from './schema';
import { replaceNoteContentExecutor } from './executor';

export const replaceNoteContentTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: replaceNoteContentSchema,
  executor: replaceNoteContentExecutor,
};

