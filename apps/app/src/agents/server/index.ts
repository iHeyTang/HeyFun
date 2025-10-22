import { agentRegistry } from './registry';

export type { AgentConfig } from './types';

export function getAgent(agentId?: string) {
  return agentRegistry.get(agentId).getConfig();
}
