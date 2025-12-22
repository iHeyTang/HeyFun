import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { getCurrentTimeSchema } from './schema';
import { getCurrentTimeExecutor } from './executor';

export const getCurrentTimeTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: getCurrentTimeSchema,
  executor: getCurrentTimeExecutor,
};

