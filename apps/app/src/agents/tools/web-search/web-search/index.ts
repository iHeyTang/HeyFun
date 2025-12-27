import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '@/agents/tools/context';
import { webSearchExecutor } from './executor';
import { webSearchSchema } from './schema';

export const webSearchTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: webSearchSchema,
  executor: webSearchExecutor,
};
