import { AgentRegistry } from '@/agents/core/frameworks/registry';
import { GeneralAgent } from './presets/general-agent';
import { IAgent } from './core/frameworks/base';
import { ReactAgent } from './core/frameworks/react';

const agentRegistry = new AgentRegistry();

agentRegistry.register(new GeneralAgent());

export function getAgent(agentId?: string) {
  return agentRegistry.get(agentId).getConfig();
}

/**
 * 获取 Agent 实例（用于调用 stream 等方法）
 */
export function getAgentInstance(agentId?: string): IAgent {
  return agentRegistry.get(agentId);
}

export function getReactAgentInstance(agentId?: string): ReactAgent {
  return agentRegistry.get(agentId) as ReactAgent;
}