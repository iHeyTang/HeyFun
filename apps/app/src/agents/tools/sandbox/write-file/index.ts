import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { sandboxWriteFileSchema } from './schema';
import { sandboxWriteFileExecutor } from './executor';

export const sandboxWriteFileTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: sandboxWriteFileSchema,
  executor: sandboxWriteFileExecutor,
};
