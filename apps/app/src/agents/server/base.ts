import { IAgent, AgentConfig } from './types';

export abstract class BaseAgent implements IAgent {
  protected abstract config: AgentConfig;

  getConfig(): AgentConfig {
    return this.config;
  }
}
