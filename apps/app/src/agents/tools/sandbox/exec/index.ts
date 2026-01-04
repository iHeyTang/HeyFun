import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { sandboxExecSchema } from './schema';
import { sandboxExecExecutor } from './executor';

export const sandboxExecTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: sandboxExecSchema,
  executor: sandboxExecExecutor,
};
