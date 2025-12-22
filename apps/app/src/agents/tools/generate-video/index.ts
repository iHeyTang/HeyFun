import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { generateVideoSchema } from './schema';
import { generateVideoExecutor } from './executor';

export const generateVideoTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: generateVideoSchema,
  executor: generateVideoExecutor,
};

