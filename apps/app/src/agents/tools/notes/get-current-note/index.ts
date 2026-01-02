import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { getCurrentNoteExecutor } from './executor';
import { getCurrentNoteSchema } from './schema';

export const getCurrentNoteTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: getCurrentNoteSchema,
  executor: getCurrentNoteExecutor,
};

