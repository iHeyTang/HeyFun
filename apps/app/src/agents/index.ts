import { AgentRegistry } from '@/agents/core/frameworks/registry';
import { CanvasAgent } from './presets/canvas-agent';
import { GeneralAgent } from './presets/general-agent';

const agentRegistry = new AgentRegistry();

agentRegistry.register(new CanvasAgent());
agentRegistry.register(new GeneralAgent());

export function getAgent(agentId?: string) {
  return agentRegistry.get(agentId).getConfig();
}
