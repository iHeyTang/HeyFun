import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { sandboxReadFileSchema } from './schema';
import { sandboxReadFileExecutor } from './executor';

export const sandboxReadFileTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: sandboxReadFileSchema,
  executor: sandboxReadFileExecutor,
};
