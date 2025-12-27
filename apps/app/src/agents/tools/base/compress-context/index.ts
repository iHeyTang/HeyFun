import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { compressContextSchema } from './schema';
import { compressContextExecutor } from './executor';

export const compressContextTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: compressContextSchema,
  executor: compressContextExecutor,
};
