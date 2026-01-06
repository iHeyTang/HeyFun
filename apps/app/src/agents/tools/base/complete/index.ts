import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { completeSchema } from './schema';
import { completeExecutor } from './executor';

export const completeTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: completeSchema,
  executor: completeExecutor,
};

