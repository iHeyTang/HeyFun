import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '@/agents/tools/context';
import { buildSystemPromptExecutor } from './executor';
import { buildSystemPromptSchema } from './schema';

export const buildSystemPromptTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: buildSystemPromptSchema,
  executor: buildSystemPromptExecutor,
};
