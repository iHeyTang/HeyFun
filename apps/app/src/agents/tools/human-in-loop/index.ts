import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { humanInLoopSchema } from './schema';
import { humanInLoopExecutor } from './executor';

export const humanInLoopTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: humanInLoopSchema,
  executor: humanInLoopExecutor,
};

