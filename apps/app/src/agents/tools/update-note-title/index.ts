import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { updateNoteTitleSchema } from './schema';
import { updateNoteTitleExecutor } from './executor';

export const updateNoteTitleTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: updateNoteTitleSchema,
  executor: updateNoteTitleExecutor,
};

