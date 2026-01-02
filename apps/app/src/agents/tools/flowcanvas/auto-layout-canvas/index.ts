import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { autoLayoutCanvasSchema } from './schema';
import { autoLayoutCanvasExecutor } from './executor';

export const autoLayoutCanvasTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: autoLayoutCanvasSchema,
  executor: autoLayoutCanvasExecutor,
};

