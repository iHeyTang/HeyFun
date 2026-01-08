import { getCurrentTimeTool } from './get-current-time';
import { waitTool } from './wait';
import { manageContextWindowTool } from './manage-context-window';
import { retrievePromptFragmentsTool } from './retrieve-prompt-fragments';
import { InitializeAgentTool } from './initialize-agent';
import { retrieveContextTool } from './retrieve-context';
import { searchToolsTool } from './search-tools';
import { completeTool } from './complete';
import { configureEnvironmentVariableTool } from './configure-environment-variable';
import { discoverMcpToolsTool } from './discover-mcp-tools';

export * from './get-current-time';
export * from './wait';
export * from './manage-context-window';
export * from './retrieve-prompt-fragments';
export * from './initialize-agent';
export * from './retrieve-context';
export * from './search-tools';
export * from './complete';
export * from './configure-environment-variable';
export * from './discover-mcp-tools';

export const baseToolboxes = [
  getCurrentTimeTool,
  waitTool,
  manageContextWindowTool,
  retrievePromptFragmentsTool,
  InitializeAgentTool,
  retrieveContextTool,
  searchToolsTool,
  completeTool,
  configureEnvironmentVariableTool,
  discoverMcpToolsTool,
];
