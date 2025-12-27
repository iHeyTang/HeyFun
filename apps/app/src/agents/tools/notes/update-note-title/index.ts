import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '@/agents/tools/context';
import { updateNoteTitleExecutor } from './executor';
import { updateNoteTitleSchema } from './schema';

export const updateNoteTitleTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: updateNoteTitleSchema,
  executor: updateNoteTitleExecutor,
};
