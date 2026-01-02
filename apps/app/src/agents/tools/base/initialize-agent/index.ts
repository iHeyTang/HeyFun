import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { initializeAgentExecutor } from './executor';
import { initializeAgentSchema } from './schema';

export const InitializeAgentTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: initializeAgentSchema,
  executor: initializeAgentExecutor,
};
