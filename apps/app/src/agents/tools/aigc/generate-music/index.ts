import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { generateMusicSchema } from './schema';
import { generateMusicExecutor } from './executor';

export const generateMusicTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: generateMusicSchema,
  executor: generateMusicExecutor,
};

