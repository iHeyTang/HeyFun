import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { noteCreateSchema } from './schema';
import { noteCreateExecutor } from './executor';

export const noteCreateTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: noteCreateSchema,
  executor: noteCreateExecutor,
};
