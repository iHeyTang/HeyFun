import { completeTool } from './complete';
import { configureEnvironmentVariableTool } from './configure-environment-variable';
import { discoverMcpToolsTool } from './discover-mcp-tools';
import { InitializeAgentTool } from './initialize-agent';
import { searchToolsTool } from './search-tools';

export * from './complete';
export * from './configure-environment-variable';
export * from './discover-mcp-tools';
export * from './initialize-agent';
export * from './search-tools';

export const baseToolboxes = [completeTool, configureEnvironmentVariableTool, discoverMcpToolsTool, InitializeAgentTool, searchToolsTool];
