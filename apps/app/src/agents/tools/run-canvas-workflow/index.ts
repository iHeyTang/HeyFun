import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { runCanvasWorkflowSchema } from './schema';
import { runCanvasWorkflowExecutor } from './executor';

export const runCanvasWorkflowTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: runCanvasWorkflowSchema,
  executor: runCanvasWorkflowExecutor,
};

