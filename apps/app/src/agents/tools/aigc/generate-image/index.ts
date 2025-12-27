import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { generateImageSchema } from './schema';
import { generateImageExecutor } from './executor';

export const generateImageTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: generateImageSchema,
  executor: generateImageExecutor,
};

