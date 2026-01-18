import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { noteReadSchema } from './schema';
import { noteReadExecutor } from './executor';

export const noteReadTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: noteReadSchema,
  executor: noteReadExecutor,
};
