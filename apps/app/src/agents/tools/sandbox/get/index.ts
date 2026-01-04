import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { sandboxGetSchema } from './schema';
import { sandboxGetExecutor } from './executor';

export const sandboxGetTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: sandboxGetSchema,
  executor: sandboxGetExecutor,
};
