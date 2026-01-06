import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { updatePresentationSchema } from './schema';
import { updatePresentationExecutor } from './executor';

export const updatePresentationTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: updatePresentationSchema,
  executor: updatePresentationExecutor,
};

