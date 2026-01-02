import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { getCanvasCapabilitiesSchema } from './schema';
import { getCanvasCapabilitiesExecutor } from './executor';

export const getCanvasCapabilitiesTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: getCanvasCapabilitiesSchema,
  executor: getCanvasCapabilitiesExecutor,
};

