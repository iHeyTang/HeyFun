import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { getCanvasStateSchema } from './schema';
import { getCanvasStateExecutor } from './executor';

export const getCanvasStateTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: getCanvasStateSchema,
  executor: getCanvasStateExecutor,
};

