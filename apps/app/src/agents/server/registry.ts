import { IAgent } from './types';
import { CoordinatorAgent } from './presets/coordinator';

class AgentRegistry {
  private agents: Map<string, IAgent> = new Map();
  private defaultAgentId: string = 'coordinator';

  constructor() {
    this.registerDefaultAgents();
  }

  private registerDefaultAgents() {
    this.register(new CoordinatorAgent());
  }

  register(agent: IAgent): void {
    const config = agent.getConfig();
    this.agents.set(config.id, agent);

    if (config.isDefault) {
      this.defaultAgentId = config.id;
    }
  }

  get(agentId?: string): IAgent {
    if (!agentId) {
      return this.getDefault();
    }

    const agent = this.agents.get(agentId);
    if (!agent) {
      console.warn(`Agent "${agentId}" not found, using default agent`);
      return this.getDefault();
    }

    return agent;
  }

  getDefault(): IAgent {
    const agent = this.agents.get(this.defaultAgentId);
    if (!agent) {
      throw new Error('Default agent not found');
    }
    return agent;
  }

  list() {
    return Array.from(this.agents.values()).map(agent => agent.getConfig());
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  unregister(agentId: string): void {
    if (agentId === this.defaultAgentId) {
      throw new Error('Cannot unregister default agent');
    }
    this.agents.delete(agentId);
  }
}

export const agentRegistry = new AgentRegistry();
