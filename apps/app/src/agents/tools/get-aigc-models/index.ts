import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { getAigcModelsSchema } from './schema';
import { getAigcModelsExecutor } from './executor';

export const getAigcModelsTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: getAigcModelsSchema,
  executor: getAigcModelsExecutor,
};

