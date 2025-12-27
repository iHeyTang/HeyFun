import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { manageContextWindowSchema } from './schema';
import { manageContextWindowExecutor } from './executor';

export const manageContextWindowTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: manageContextWindowSchema,
  executor: manageContextWindowExecutor,
};

