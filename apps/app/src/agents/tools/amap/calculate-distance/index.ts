import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { calculateDistanceSchema } from './schema';
import { calculateDistanceExecutor } from './executor';

export const calculateDistanceTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: calculateDistanceSchema,
  executor: calculateDistanceExecutor,
};
