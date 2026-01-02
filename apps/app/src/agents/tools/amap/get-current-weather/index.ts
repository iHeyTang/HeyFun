import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { getCurrentWeatherExecutor } from './executor';
import { getCurrentWeatherSchema } from './schema';

export const getCurrentWeatherTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: getCurrentWeatherSchema,
  executor: getCurrentWeatherExecutor,
};
