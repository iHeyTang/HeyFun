import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { imageSearchExecutor } from './executor';
import { imageSearchSchema } from './schema';

export const imageSearchTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: imageSearchSchema,
  executor: imageSearchExecutor,
};
