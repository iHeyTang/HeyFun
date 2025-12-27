import { AgentRegistry } from '@/agents/core/frameworks/registry';
import { CanvasAgent } from './presets/canvas-agent';
import { GeneralAgent } from './presets/general-agent';
import { NotesAgent } from './presets/notes-agent';
import { IAgent } from './core/frameworks/base';

const agentRegistry = new AgentRegistry();

agentRegistry.register(new CanvasAgent());
agentRegistry.register(new GeneralAgent());
agentRegistry.register(new NotesAgent());

export function getAgent(agentId?: string) {
  return agentRegistry.get(agentId).getConfig();
}

/**
 * 获取 Agent 实例（用于调用 stream 等方法）
 */
export function getAgentInstance(agentId?: string): IAgent {
  return agentRegistry.get(agentId);
}
