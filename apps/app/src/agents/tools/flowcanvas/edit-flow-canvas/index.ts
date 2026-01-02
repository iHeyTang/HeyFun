import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { editFlowCanvasSchema } from './schema';
import { editFlowCanvasExecutor } from './executor';

export const editFlowCanvasTool: {
  schema: ToolDefinition;
  executor: ToolExecutor;
} = {
  schema: editFlowCanvasSchema,
  executor: editFlowCanvasExecutor,
};

