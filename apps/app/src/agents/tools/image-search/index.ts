import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { imageSearchSchema } from './schema';
import { imageSearchExecutor } from './executor';

export const imageSearchTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: imageSearchSchema,
  executor: imageSearchExecutor,
};

