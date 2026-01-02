import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { searchToolsSchema } from './schema';
import { searchToolsExecutor } from './executor';

export const searchToolsTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: searchToolsSchema,
  executor: searchToolsExecutor,
};

