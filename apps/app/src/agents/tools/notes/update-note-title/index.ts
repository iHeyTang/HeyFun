import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { updateNoteTitleExecutor } from './executor';
import { updateNoteTitleSchema } from './schema';

export const updateNoteTitleTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: updateNoteTitleSchema,
  executor: updateNoteTitleExecutor,
};
