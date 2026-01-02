import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { retrieveContextSchema } from './schema';
import { retrieveContextExecutor } from './executor';

export const retrieveContextTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: retrieveContextSchema,
  executor: retrieveContextExecutor,
};

