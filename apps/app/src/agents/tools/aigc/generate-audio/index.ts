import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { generateAudioSchema } from './schema';
import { generateAudioExecutor } from './executor';

export const generateAudioTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: generateAudioSchema,
  executor: generateAudioExecutor,
};

