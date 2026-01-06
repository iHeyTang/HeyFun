import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { wikiSearchExecutor } from './executor';
import { wikiSearchSchema } from './schema';

export const wikiSearchTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: wikiSearchSchema,
  executor: wikiSearchExecutor,
};

