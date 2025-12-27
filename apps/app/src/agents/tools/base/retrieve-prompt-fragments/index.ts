import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { retrievePromptFragmentsSchema } from './schema';
import { retrievePromptFragmentsExecutor } from './executor';

export const retrievePromptFragmentsTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: retrievePromptFragmentsSchema,
  executor: retrievePromptFragmentsExecutor,
};

