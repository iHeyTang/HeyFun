import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { routePlanningSchema } from './schema';
import { routePlanningExecutor } from './executor';

export const routePlanningTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: routePlanningSchema,
  executor: routePlanningExecutor,
};
