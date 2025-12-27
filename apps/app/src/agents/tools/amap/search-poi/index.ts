import { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolContext } from '../../context';
import { ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { searchPoiSchema } from './schema';
import { searchPoiExecutor } from './executor';

export const searchPoiTool: {
  schema: ToolDefinition;
  executor: ToolExecutor<ToolContext>;
} = {
  schema: searchPoiSchema,
  executor: searchPoiExecutor,
};
