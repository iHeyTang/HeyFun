import { AgentRegistry } from '@/agents/core/frameworks/registry';
import { CanvasAgent } from './presets/canvas-agent';
import { GeneralAgent } from './presets/general-agent';
import { NotesAgent } from './presets/notes-agent';

const agentRegistry = new AgentRegistry();

agentRegistry.register(new CanvasAgent());
agentRegistry.register(new GeneralAgent());
agentRegistry.register(new NotesAgent());

export function getAgent(agentId?: string) {
  return agentRegistry.get(agentId).getConfig();
}
