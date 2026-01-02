import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { getNodeTypeInfoSchema } from './schema';
import { getNodeTypeInfoExecutor } from './executor';

export const getNodeTypeInfoTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: getNodeTypeInfoSchema,
  executor: getNodeTypeInfoExecutor,
};

