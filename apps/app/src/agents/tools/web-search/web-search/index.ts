import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { webSearchExecutor } from './executor';
import { webSearchSchema } from './schema';

export const webSearchTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: webSearchSchema,
  executor: webSearchExecutor,
};
