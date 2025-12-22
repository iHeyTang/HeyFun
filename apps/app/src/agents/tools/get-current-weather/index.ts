import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { getCurrentWeatherSchema } from './schema';
import { getCurrentWeatherExecutor } from './executor';

export const getCurrentWeatherTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: getCurrentWeatherSchema,
  executor: getCurrentWeatherExecutor,
};

