import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { geocodeSchema } from './schema';
import { geocodeExecutor } from './executor';

export const geocodeTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: geocodeSchema,
  executor: geocodeExecutor,
};
