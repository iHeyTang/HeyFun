import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { reverseGeocodeSchema } from './schema';
import { reverseGeocodeExecutor } from './executor';

export const reverseGeocodeTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: reverseGeocodeSchema,
  executor: reverseGeocodeExecutor,
};
