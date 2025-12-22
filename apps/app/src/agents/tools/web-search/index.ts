import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { webSearchSchema } from './schema';
import { webSearchExecutor } from './executor';

export const webSearchTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: webSearchSchema,
  executor: webSearchExecutor,
};

