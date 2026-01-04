import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { transcribeMediaSchema } from './schema';
import { transcribeMediaExecutor } from './executor';

export const transcribeMediaTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: transcribeMediaSchema,
  executor: transcribeMediaExecutor,
};

