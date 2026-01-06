import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { generatePresentationSchema } from './schema';
import { generatePresentationExecutor } from './executor';

export const generatePresentationTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: generatePresentationSchema,
  executor: generatePresentationExecutor,
};

