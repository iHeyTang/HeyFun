import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '@/agents/tools/context';
import { getCurrentWeatherExecutor } from './executor';
import { getCurrentWeatherSchema } from './schema';

export const getCurrentWeatherTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: getCurrentWeatherSchema,
  executor: getCurrentWeatherExecutor,
};
