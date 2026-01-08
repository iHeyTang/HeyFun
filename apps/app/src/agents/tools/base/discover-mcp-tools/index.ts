import { mcpDiscoverToolsSchema } from './schema';
import { mcpDiscoverToolsExecutor } from './executor';
import { Tool } from '../../registry';

export const discoverMcpToolsTool: Tool = {
  schema: mcpDiscoverToolsSchema,
  executor: mcpDiscoverToolsExecutor,
};
