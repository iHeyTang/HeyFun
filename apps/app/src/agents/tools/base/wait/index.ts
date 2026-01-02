import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { waitSchema } from './schema';
import { waitExecutor } from './executor';

export const waitTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: waitSchema,
  executor: waitExecutor,
};

