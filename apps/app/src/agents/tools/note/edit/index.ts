import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { noteEditSchema } from './schema';
import { noteEditExecutor } from './executor';

export const noteEditTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: noteEditSchema,
  executor: noteEditExecutor,
};
