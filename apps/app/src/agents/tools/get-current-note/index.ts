import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { getCurrentNoteSchema } from './schema';
import { getCurrentNoteExecutor } from './executor';

export const getCurrentNoteTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: getCurrentNoteSchema,
  executor: getCurrentNoteExecutor,
};

